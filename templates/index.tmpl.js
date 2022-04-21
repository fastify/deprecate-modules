'use strict'

const warning = require('process-warning')()
warning.create('FastifyWarning.<<module_name>>', 'FST_MODULE_DEP_<<module_name>>'.toUpperCase(), '<<module_name>> has been deprecated. Use <<new_module_name>>@<<new_module_version>> instead.')
warning.emit('FST_MODULE_DEP_<<module_name>>'.toUpperCase())

module.exports = require('<<module_name>>-deprecated')
