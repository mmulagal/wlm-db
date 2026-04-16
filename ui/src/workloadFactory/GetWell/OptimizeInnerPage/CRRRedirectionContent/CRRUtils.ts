export const OPEN_FIX_VOLUME_QUERY = 'openFixVolume';

/** `volumeName` + `target` + literal `comingFrom` + source param — sole CRR deep-link shape in `Home.tsx`. */
export const INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME_AND_COMING_FROM =
    '/inventory/:credId/:regionId/:fsxId/resource/:resourceId/instance/:instanceId/host/:hostname/db/:dbInstanceName/volumeName/:volumeName/target/:target/comingFrom/:comingFrom/*';

/** Full path patterns for `OptimizeInnerPage` / CRR deep-link detection (`/databases` and `/fsxdb` prefixes). */
export const INVENTORY_FSX_DEEP_LINK_MATCH_PATTERNS = [
    `/databases${INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME_AND_COMING_FROM}`,
    `/fsxdb${INVENTORY_FSX_DEEP_LINK_PATH_WITH_VOLUME_AND_COMING_FROM}`
] as const;

export const decodeVolumeParam = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
        return decodeURIComponent(trimmed);
    } catch {
        return trimmed;
    }
};

/** Resolves table row data for CRR Fix dialog from a volume name (query or path splat). */
export const findCrrRowDataByVolumeName = (volumeName: string, cardData: any) => {
    if (!volumeName || !cardData?.objectsInViolation?.length) return null;
    const decoded = decodeVolumeParam(volumeName);
    for (let i = 0; i < cardData.objectsInViolation.length; i++) {
        const row = cardData.objectsInViolation[i];
        const volName = typeof row === 'string' ? row : row?.ontapVolumeName;
        if (volName && (volName === decoded || volName.toLowerCase() === decoded.toLowerCase())) {
            return {
                volumeName: volName,
                volumeId: typeof row === 'string' ? '' : row?.fsxVolumeId || '',
                id: String(i)
            };
        }
    }
    return null;
};

export const pathnameWithoutTrailingSplat = (pathname: string, splat: string) => {
    if (!splat) return pathname;
    const suffix = `/${splat}`;
    return pathname.endsWith(suffix) ? pathname.slice(0, -suffix.length) : pathname;
};

/** Strips `/volumeName/:volumeName` after clearing a CRR deep link from the URL. */
export const pathnameWithoutVolumeNameSegment = (pathname: string) => pathname.replace(/\/volumeName\/[^/]+/, '');
