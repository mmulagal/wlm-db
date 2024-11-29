#!/usr/bin/env bash

set -o pipefail
echo "shalom"
client_id=$1 # Client ID as first argument

pem=$( cat /var/tmp/git.pem ) # file path of the private key as second argument

now=$( date +%s )
#echo $now
iat=$((${now} - 60)) # Issues 60 seconds in the past
#echo $iat
exp=$((${now} + 600)) # Expires 10 minutes in the future
#echo $exp 

b64enc() { openssl base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'; }

header_json='{
    "typ":"JWT",
    "alg":"RS256"
}'
# Header encode
header=$( echo -n "${header_json}" | b64enc )

payload_json='{
    "iat":'"${iat}"',
    "exp":'"${exp}"',
    "iss":'"${client_id}"'
}'
# Payload encode
payload=$( echo -n "${payload_json}" | b64enc )

# Signature
header_payload="${header}"."${payload}"
signature=$(
    openssl dgst -sha256 -sign <(echo -n "${pem}") \
    <(echo -n "${header_payload}") | b64enc
)

# Create JWT
JWT="${header_payload}"."${signature}"
printf '%s\n' "JWT: $JWT"