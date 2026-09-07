#!/usr/bin/env bash
# Self-check for this directory: these scripts are loaded by scriptId and run
# unattended on production Oracle hosts via SSM, so a syntax error only
# surfaces mid-clone. Verify every .sh parses under both dash (SSM's likely
# fallback shell) and bash, and every .py compiles, before trusting a script
# here — see server/src/operations/workloads/oracle/oracle-admin-scripts.ts,
# which is the only thing that reads these files at runtime.
set -euo pipefail
cd "$(dirname "$0")"

fail=0
# *.sh execute on the target host via SSM, which can fall back to dash/sh —
# must parse there too.
for f in *.sh; do
    [[ -f "$f" ]] || continue
    if command -v dash >/dev/null 2>&1 && ! dash -n "$f" 2>/tmp/syntax_err; then
        echo "FAIL (dash -n): $f"; cat /tmp/syntax_err; fail=1
    fi
    if ! bash -n "$f" 2>/tmp/syntax_err; then
        echo "FAIL (bash -n): $f"; cat /tmp/syntax_err; fail=1
    fi
done
# The oracle-admin skill's own wrapper scripts run locally under an explicit
# `#!/usr/bin/env bash` and use bash-only syntax (arrays) by design, so only
# bash-check those — they are not sent to any Oracle host.
skill_scripts_dir="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)/.cursor/skills/oracle-admin/scripts"
for f in "$skill_scripts_dir"/*.sh; do
    [[ -f "$f" ]] || continue
    if ! bash -n "$f" 2>/tmp/syntax_err; then
        echo "FAIL (bash -n): $f"; cat /tmp/syntax_err; fail=1
    fi
done
for f in *.py; do
    [[ -f "$f" ]] || continue
    if ! python3 -m py_compile "$f" 2>/tmp/syntax_err; then
        echo "FAIL (py_compile): $f"; cat /tmp/syntax_err; fail=1
    fi
done

# A *.py body is sent as the run-script "command", which SSM executes as a
# shell script — so oracle-admin-scripts.ts's loadOracleAdminScript() wraps it
# in the same python-heredoc shape reproduced below. Check the wrapped command
# parses as shell (an unwrapped python body does not).
if command -v jq >/dev/null 2>&1; then
    for f in *.py; do
        [[ -f "$f" ]] || continue
        {
            printf 'PYTHON=$(command -v python3 || command -v python) || {\n'
            printf '    echo '"'"'{"status":"error","error":"no python interpreter found on host"}'"'"'\n'
            printf '    exit 1\n'
            printf '}\n'
            printf '"$PYTHON" - <<'"'"'WLMDB_PY'"'"'\n'
            cat "$f"
            printf '\nWLMDB_PY\n'
        } > /tmp/syntax_cmd
        for shell in dash bash; do
            command -v "$shell" >/dev/null 2>&1 || continue
            if ! "$shell" -n /tmp/syntax_cmd 2>/tmp/syntax_err; then
                echo "FAIL ($shell -n on wrapped command): $f"; cat /tmp/syntax_err; fail=1
            fi
        done
    done
fi

# clone_attach_nfs.sh mounts "${SVM_DATA_LIF}:/${clone_volume_name}" literally, so the
# FlexClone create call must request that exact junction path — regression check for the
# "FlexClone missing NFS junction path" bug (unjunctioned clone -> silent NFS mount failure).
if ! grep -q '"nas": {"path": "/{}".format(clone_name)}' flexclone_create.py; then
    echo "FAIL: flexclone_create.py must set nas.path to /<clone_name> so the NFS clone mount can find the junction"
    fail=1
fi

# Regression check for "NFS mount path collisions": two volumes sharing a fileType (common
# for DATA_FILES) must land at distinct mount paths, or the second mount overwrites the first
# and the clone is silently incomplete. Stub `mount` so this runs without real NFS/root access.
if command -v jq >/dev/null 2>&1; then
    stub_bin=$(mktemp -d)
    printf '#!/bin/sh\nexit 0\n' > "$stub_bin/mount"
    printf '#!/bin/sh\nexit 0\n' > "$stub_bin/mkdir"
    chmod +x "$stub_bin/mount" "$stub_bin/mkdir"
    volumes_json='[{"fileType":"DATA_FILES","cloneVolumeName":"clone_vol_1"},{"fileType":"DATA_FILES","cloneVolumeName":"clone_vol_2"}]'
    result=$(PATH="$stub_bin:$PATH" CLONE_SID=testsid SVM_DATA_LIF=1.2.3.4 \
        CLONE_VOLUMES_JSON="$volumes_json" sh ./clone_attach_nfs.sh)
    mount_path_count=$(echo "$result" | jq '[.mounts[].mountPath] | unique | length')
    if [[ "$(echo "$result" | jq -r '.status')" != "ok" || "$mount_path_count" != "2" ]]; then
        echo "FAIL: clone_attach_nfs.sh gave colliding/failed mount paths for two same-fileType volumes: $result"
        fail=1
    fi
    rm -rf "$stub_bin"
fi

pdb_work=$(mktemp -d)
mkdir -p "$pdb_work/bin" "$pdb_work/oracle_home/bin"
printf 'TESTCDB:%s:N\n' "$pdb_work/oracle_home" > "$pdb_work/oratab"
cat > "$pdb_work/bin/sudo" <<'EOS'
#!/bin/sh
while [ $# -gt 0 ]; do
  case "$1" in
    -i) shift ;;
    -u) shift 2 ;;
    *) break ;;
  esac
done
exec "$@"
EOS
cat > "$pdb_work/oracle_home/bin/sqlplus" <<'EOS'
#!/bin/sh
cat > "$CAPTURED_SQL"
printf '%s\n' "$STUB_OUT"
EOS
chmod +x "$pdb_work/bin/sudo" "$pdb_work/oracle_home/bin/sqlplus"
for f in create_pdb.sh pdb_exists_check.sh; do
    sed "s#/etc/oratab#$pdb_work/oratab#g" "$f" > "$pdb_work/$f"
done

create_envelope=$(CAPTURED_SQL="$pdb_work/create.sql" STUB_OUT="READWRITE" PATH="$pdb_work/bin:$PATH" \
    ORACLE_SID=TESTCDB PDB_NAME=myapp PDB_ADMIN_USER=pdbadmin PDB_ADMIN_PASSWORD='sEcRet#1' \
    sh "$pdb_work/create_pdb.sh")
if ! grep -q 'CREATE PLUGGABLE DATABASE "MYAPP" ADMIN USER "PDBADMIN"' "$pdb_work/create.sql"; then
    echo "FAIL: create_pdb.sh must fold PDB_NAME and PDB_ADMIN_USER to uppercase in the DDL"
    cat "$pdb_work/create.sql"; fail=1
fi
if ! grep -q 'IDENTIFIED BY "sEcRet#1"' "$pdb_work/create.sql"; then
    echo "FAIL: create_pdb.sh must NOT fold PDB_ADMIN_PASSWORD — passwords are case-sensitive"
    fail=1
fi
if [[ "$create_envelope" != *'"adminUser":"PDBADMIN"'* ]]; then
    echo "FAIL: create_pdb.sh envelope must report the folded admin user: $create_envelope"
    fail=1
fi

CAPTURED_SQL="$pdb_work/exists.sql" STUB_OUT="0" PATH="$pdb_work/bin:$PATH" \
    ORACLE_SID=TESTCDB PDB_NAME=myapp sh "$pdb_work/pdb_exists_check.sh" >/dev/null
if ! grep -q "NAME = 'MYAPP'" "$pdb_work/exists.sql"; then
    echo "FAIL: pdb_exists_check.sh must fold PDB_NAME before the case-sensitive V\$PDBS compare"
    cat "$pdb_work/exists.sql"; fail=1
fi
rm -rf "$pdb_work"

# Regression check for Data Guard topology reporting: a DG PRIMARY is a supported snapshot/clone
# source and must come back status=ok / deploymentType=dataguard-primary, a standby must stay
# refused, and an inconclusive DG probe must NOT report "standalone" (callers gate PDB creation on
# that string, so over-claiming standalone is the dangerous direction). Stubs sudo + sqlplus and
# redirects the hardcoded /etc/oratab lookup. `grep -oP` is GNU-only and these scripts target
# Linux hosts, so shim it via perl (which also understands \K) when the local grep lacks -P.
if command -v jq >/dev/null 2>&1 && command -v perl >/dev/null 2>&1; then
    dg_work=$(mktemp -d)
    mkdir -p "$dg_work/bin" "$dg_work/home/bin"
    printf 'TESTSID:%s:N\n' "$dg_work/home" > "$dg_work/oratab"
    cat > "$dg_work/bin/sudo" <<'EOS'
#!/bin/sh
while [ $# -gt 0 ]; do case "$1" in -i) shift ;; -u) shift 2 ;; *) break ;; esac; done
exec "$@"
EOS
    if ! echo x | grep -qoP 'x' 2>/dev/null; then
        cat > "$dg_work/bin/grep" <<'EOS'
#!/bin/sh
if [ "$1" = "-oP" ]; then
    p="$2"; shift 2
    PAT="$p" exec perl -ne 'while(/$ENV{PAT}/g){print "$&\n"}' "$@"
fi
exec /usr/bin/grep "$@"
EOS
        chmod +x "$dg_work/bin/grep"
    fi
    cat > "$dg_work/home/bin/sqlplus" <<'EOS'
#!/bin/sh
cat > /dev/null
n=$(cat "$CALLC" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$CALLC"
if [ "$n" = 1 ]; then printf '%s\n' "$CORE_OUT"; else printf '%s\n' "$DG_OUT"; fi
EOS
    chmod +x "$dg_work/bin/sudo" "$dg_work/home/bin/sqlplus"
    sed "s#/etc/oratab#$dg_work/oratab#g" topology_check.sh > "$dg_work/tc.sh"

    dg_run() {
        : > "$dg_work/calls"
        CALLC="$dg_work/calls" CORE_OUT="$1" DG_OUT="$2" PATH="$dg_work/bin:$PATH" \
            ORACLE_SID=TESTSID sh "$dg_work/tc.sh"
    }
    # $6 also pins validate_operation_result.sh against the envelope topology_check.sh actually
    # emits. The two drifted once already: the validator still demanded deploymentType
    # "standalone" after Data Guard primaries became supported, so a supported source failed
    # validation. Asserting both sides off one generated envelope is what catches that.
    dg_expect() {
        # $1 label, $2 core sql output, $3 dg sql output, $4 expected status,
        # $5 expected deploymentType, $6 expected validator verdict (pass|fail)
        result=$(dg_run "$2" "$3")
        got_status=$(echo "$result" | jq -r '.status')
        got_type=$(echo "$result" | jq -r '.deploymentType')
        if [[ "$got_status" != "$4" || "$got_type" != "$5" ]]; then
            echo "FAIL: topology_check.sh $1 — expected status=$4 deploymentType=$5, got status=$got_status deploymentType=$got_type"
            fail=1
        fi
        printf '%s\n' "$result" > "$dg_work/envelope.json"
        if "$skill_scripts_dir/validate_operation_result.sh" "$dg_work/envelope.json" topology >/dev/null 2>&1; then
            verdict=pass
        else
            verdict=fail
        fi
        if [[ "$verdict" != "$6" ]]; then
            echo "FAIL: validate_operation_result.sh disagrees with topology_check.sh for $1 — expected validator to $6 deploymentType=$got_type, it $verdict"
            fail=1
        fi
    }
    dg_expect 'Data Guard primary' 'OPEN_MODE=READ WRITE|CDB=YES|ROLE=PRIMARY|RAC=false' \
        'DGBROKER=TRUE|DGCONFIG=true|STANDBYS=1' ok dataguard-primary pass
    dg_expect 'plain standalone' 'OPEN_MODE=READ WRITE|CDB=YES|ROLE=PRIMARY|RAC=false' \
        'DGBROKER=FALSE|DGCONFIG=false|STANDBYS=0' ok standalone pass
    dg_expect 'Data Guard standby' 'OPEN_MODE=MOUNTED|CDB=NO|ROLE=PHYSICAL STANDBY|RAC=false' \
        'DGBROKER=TRUE|DGCONFIG=true|STANDBYS=1' unsupported dataguard-standby fail
    dg_expect 'RAC' 'OPEN_MODE=READ WRITE|CDB=NO|ROLE=PRIMARY|RAC=true' \
        'DGBROKER=FALSE|DGCONFIG=false|STANDBYS=0' unsupported rac fail
    dg_expect 'inconclusive DG probe' 'OPEN_MODE=READ WRITE|CDB=YES|ROLE=PRIMARY|RAC=false' \
        'ORA-00942: table or view does not exist' ok unknown fail
    rm -rf "$dg_work"
fi

# Regression check for "ontap_request times out before return_timeout": the mutating POSTs ask
# ONTAP to hold the connection until the snapshot/clone finishes (return_timeout), so the client
# socket timeout must outlast it. A shorter socket timeout aborts the read while the ONTAP job
# keeps running, and the script reports failure for a snapshot/clone that then gets created —
# the worst outcome for a mutating call. Points ontap_request at a socket that accepts and never
# answers, with HTTP_TIMEOUT monkeypatched to 2s: it must give up on that budget, not on a
# hardcoded one.
python3 - <<'PY' || fail=1
import socket
import sys
import time


def load_prefix(path):
    """exec everything above the driver so the module's helpers are reachable.

    These scripts have no __main__ guard (they are piped to python via an SSM
    heredoc), so importing one would run the whole snapshot/clone flow.
    setup_logging() is the first statement of the driver in both files.
    """
    src = open(path).read()
    ns = {"__name__": "probe"}
    exec(compile(src[:src.index("\nsetup_logging()")], path, "exec"), ns)
    return ns


failures = []
for path in ("consistency_group_snapshot.py", "flexclone_create.py"):
    ns = load_prefix(path)
    if ns["HTTP_TIMEOUT"] <= ns["ONTAP_RETURN_TIMEOUT"]:
        failures.append("%s: HTTP_TIMEOUT (%s) must exceed ONTAP_RETURN_TIMEOUT (%s)"
                        % (path, ns["HTTP_TIMEOUT"], ns["ONTAP_RETURN_TIMEOUT"]))

    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    ns["HTTP_TIMEOUT"] = 2
    cfg = {"username": "u", "password": "p", "use_insecure": True, "cert_path": None,
           "management_ip": "127.0.0.1:%d" % srv.getsockname()[1]}
    start = time.time()
    try:
        ns["ontap_request"](cfg, "GET", "cluster/jobs/deadbeef")
        failures.append("%s: ontap_request returned from a dead endpoint" % path)
    except Exception:
        pass
    elapsed = time.time() - start
    srv.close()
    if elapsed > 10:
        failures.append("%s: ontap_request ignored HTTP_TIMEOUT (%.0fs elapsed on a 2s budget) —"
                        " urlopen is using a hardcoded socket timeout" % (path, elapsed))

for f in failures:
    print("FAIL: %s" % f)
sys.exit(1 if failures else 0)
PY

rm -rf __pycache__ /tmp/syntax_err /tmp/syntax_cmd

if [[ "$fail" -eq 0 ]]; then
    echo "OK: all scripts parse cleanly"
else
    exit 1
fi
