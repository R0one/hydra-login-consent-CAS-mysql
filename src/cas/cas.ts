import { casConfig } from "./config";

var CASAuthentication = require('cas-authentication')

// Create a new instance of CASAuthentication.
var cas = new CASAuthentication({
    cas_url     : casConfig.URL || 'casUrlNotDefined',
    service_url : process.env.BASE_URL || '',
    cas_version     : '3.0',
    renew           : false,
    is_dev_mode     : false,
    destroy_session : false,
    session_info    : true
});

export { cas }