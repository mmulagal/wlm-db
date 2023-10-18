import { RouteTags } from '../../utils/consts';
import { WidgetStatusResponse, AccountIdParams } from '../types/widgets.types';

const GetWidgetStatusSchema = {
    tags: [RouteTags.WIDGET],
    description: 'Get widget status',
    params: AccountIdParams,
    response: {
        200: WidgetStatusResponse
    }
};

export default GetWidgetStatusSchema;
