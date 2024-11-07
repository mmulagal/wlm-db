import { Static, Type } from '@fastify/type-provider-typebox';
import { OPTIMIZE_SIZING_CONFIGS } from '../../utils/continous-optimization-consts';

const OptimizeSizingQueryParams = Type.Object({
    type: Type.String(Type.Enum(OPTIMIZE_SIZING_CONFIGS))
});

type OptimizeSizingQueryParamsType = Static<typeof OptimizeSizingQueryParams>;

export { OptimizeSizingQueryParams, OptimizeSizingQueryParamsType };
