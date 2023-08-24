// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import sinon from 'sinon';
import randomize from 'randomatic';
import { context, trace } from '@opentelemetry/api';

// mocking a fake response for simulator purpose only
sinon.stub(context, 'active').callsFake(async () => {});

sinon.stub(trace, 'getSpan').callsFake(() => {
    return {
        spanContext: () => {
            return {
                traceId: randomize('Aa0', 15)
            };
        }
    };
});
