import { resolve } from 'path'

const projectRootDir = resolve(__dirname)

/**
 * Shared resolve config for WAD bundle builds.
 *
 * - workload-factory-components resolves from node_modules (@tlveng/workload-factory-components)
 * - BXP is pinned to this package's node_modules so all Table imports share one version
 *
 * Important: @netapp/bxp-design-system-react must match the version baked into the
 * installed @tlveng/workload-factory-components dist (createWadMount inlines BXP CSS
 * at publish time). Mismatched versions break WAD table layout (CSS module hash mismatch).
 */
export const wadBuildResolve = {
    alias: {
        '@netapp/bxp-design-system-react': resolve(projectRootDir, 'node_modules/@netapp/bxp-design-system-react'),
        '@netapp/bxp-style': resolve(projectRootDir, 'node_modules/@netapp/bxp-style'),
    },
    dedupe: [
        'react',
        'react-dom',
        '@emotion/react',
        '@emotion/styled',
        '@netapp/bxp-design-system-react',
        '@tlveng/workload-factory-components',
    ],
}

export const wadProjectRootDir = projectRootDir
