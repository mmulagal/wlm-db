import sinon from 'sinon';
import jwtOperation from '../../../src/utils/jwt';

// mocking the verifyToken by directly sending a fake response for simulator purpose only
sinon
    .stub(jwtOperation, 'verifyToken')
    .callsFake(
        async () =>
            '{"http://cloud.netapp.com/full_name":"WLMDB Server","iss":"https://staging-test.com/","sub":"auth0|849434583535","iat":1698989696,"exp":1699011296,"scope":"openid profile email cc:update-password"}'
    );
