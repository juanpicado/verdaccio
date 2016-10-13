const Logger = require('bunyan');
const Error  = require('http-errors');
const Stream = require('stream');
const Utils  = require('./utils');
const chalk = require('chalk');

function getlvl(x) {
  switch(true) {
    case x < 15  : return 'trace'
    case x < 25  : return 'debug'
    case x < 35  : return 'info'
    case x == 35 : return 'http'
    case x < 45  : return 'warn'
    case x < 55  : return 'error'
    default      : return 'fatal'
  }
}

module.exports.setup = function(logs) {
  var streams = []
  if (logs == null) logs = [{ type: 'stdout', format: 'pretty', level: 'http' }]

  logs.forEach(function(target) {
    var stream = new Stream()
    stream.writable = true

    if (target.type === 'stdout' || target.type === 'stderr') {
      // destination stream
      var dest = target.type === 'stdout' ? process.stdout : process.stderr

      if (target.format === 'pretty') {
        // making fake stream for prettypritting
        stream.write = function(obj) {
          dest.write(print(obj.level, obj.msg, obj, dest.isTTY) + '\n')
        }
      } else if (target.format === 'pretty-timestamped') {
        // making fake stream for prettypritting
        stream.write = function(obj) {
          dest.write(obj.time.toISOString() + print(obj.level, obj.msg, obj, dest.isTTY) + '\n')
        }
      } else {
        stream.write = function(obj) {
          dest.write(JSON.stringify(obj, Logger.safeCycles()) + '\n')
        }
      }
    } else if (target.type === 'file') {
      var dest = require('fs').createWriteStream(target.path, {flags: 'a', encoding: 'utf8'})
      dest.on('error', function (err) {
        Logger.emit('error', err)
      })
      stream.write = function(obj) {
        if (target.format === 'pretty') {
          dest.write(print(obj.level, obj.msg, obj, false) + '\n')
        } else {
          dest.write(JSON.stringify(obj, Logger.safeCycles()) + '\n')
        }
      }
    } else {
      throw Error('wrong target type for a log')
    }

    if (target.level === 'http') target.level = 35
    streams.push({
      type: 'raw',
      level: target.level || 35,
      stream: stream,
    })
  })

  var logger = new Logger({
    name: 'sinopia',
    streams: streams,
    serializers: {
      err: Logger.stdSerializers.err,
      req: Logger.stdSerializers.req,
      res: Logger.stdSerializers.res,
    },
  })

  module.exports.logger = logger
}

// adopted from socket.io
// this part was converted to coffee-script and back again over the years,
// so it might look weird

// level to color
var levels = {
  fatal : chalk.bold.red,
  error : chalk.red,
  warn  : chalk.yellow,
  http  : chalk.magenta,
  info  : chalk.blue,
  debug : chalk.green,
  trace : chalk.gray,
}

var max = 0;
for (var l in levels) {
  max = Math.max(max, l.length)
}

function pad(str) {
  if (str.length < max) return str + ' '.repeat(max - str.length)
  return str
}

var subsystems = [{
  in      : chalk.green('<--'),
  out     : chalk.yellow('-->'),
  fs      : chalk.gray('-=-'),
  default : chalk.blue('---'),
}, {
  in      : '<--',
  out     : '-->',
  fs      : '-=-',
  default : '---',
}]

function print(type, msg, obj, colors) {
  if (typeof type === 'number') type = getlvl(type)
  var finalmsg = msg.replace(/@{(!?[$A-Za-z_][$0-9A-Za-z\._]*)}/g, function(_, name) {
    var str = obj, is_error
    if (name[0] === '!') {
      name = name.substr(1)
      is_error = true
    }

    var _ref = name.split('.')
    for (var _i = 0; _i < _ref.length; _i++) {
      var id = _ref[_i]
      if (Utils.is_object(str) || Array.isArray(str)) {
        str = str[id]
      } else {
        str = undefined
      }
    }

    if (typeof(str) === 'string') {
      if (!colors || str.includes('\n')) {
        return str
      } else if (is_error) {
        return chalk.red(str);
      } else {
        return chalk.green(str);
      }
    } else {
      return require('util').inspect(str, null, null, colors)
    }
  })

  var sub = subsystems[colors ? 0 : 1][obj.sub] || subsystems[+!colors].default
  if (colors) {
    // FIXME: fix levels
    //return ' \033[' + levels[type] + 'm' + (pad(type)) + '\033[39m ' + sub + ' ' + finalmsg
  } else {
    return ' ' + (pad(type)) + ' ' + sub + ' ' + finalmsg
  }
}

