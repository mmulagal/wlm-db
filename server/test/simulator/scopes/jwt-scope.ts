import sinon from 'sinon';
import jwtOperation from '../../../src/utils/jwt';

// mocking the verifyToken by directly sending a fake response for simulator purpose only
sinon.stub(jwtOperation, 'verifyToken').callsFake(async () => 'verified');

sinon.stub(jwtOperation, 'authorizeJwt').callsFake(async () => {});
