#!/usr/bin/env node
/* eslint dot-location: ["off"] */

var async = require('async');
var debug = require('debug')('getadsmtp');
var name = 'getadsmtp';
var argv = require('yargs')
    .usage('Usage: $0 [options]')
    .help('h')
    .alias('h', 'help')
    .demand(['username', 'password', 'server'])
    .describe('username', 'LDAP username')
    .describe('password', 'LDAP password')
    .describe('server', 'LDAP server in the format ldaps://my.server.tld')
    .describe('search', 'Search OU (i.e. dc=mycompany,dc=local')
    .describe('groups', 'Include group addresses')
    .describe('folders', 'Include public folder addresses')
    .describe('contacts', 'Include addresses from contacts')
    .describe('users', 'Include addresses from users with mailboxes')
    .describe('rooms', 'Include rooms')
    .describe('filter-garbage', 'Remove "garbage" from AD (like system mailboxes)')
    .describe('ignore-local', 'Ignore addresses ending with .local')
    .describe('haraka-rcpt-to-routes', 'Output in Haraka rcpt_to.routes format, requires specifying the URI for delivery')
    .describe('postfix-transport-map', 'Output in a format suitable for a Postfix transport map, requires specifying the destination server')
    .describe('mailenabledcontacts', 'Include mail-enabled contacts')
    .requiresArg('haraka-rcpt-to-routes')
    .requiresArg('postfix-transport-map')
    .requiresArg('search')
    .argv;

var ldap = require('ldapjs');


function ldap_connect(callback) {
    var client = ldap.createClient({
        url: argv.server,
        tlsOptions: { 'rejectUnauthorized': false }
    });
    callback(client);
}

var opts = {
    attributes: ['dn', 'proxyAddresses'],
    scope: 'sub'
};

function write_line(data) {
    if (argv.harakaRcptToRoutes) {
        console.log(data.toLowerCase() + '=' + argv.harakaRcptToRoutes.toLowerCase());
    } else if (argv.postfixTransportMap) {
        console.log(data.toLowerCase() + "\t" + argv.postfixTransportMap.toLowerCase());
    } else {
        console.log(data);
    }
}

function query_ldap(client, opts, callback) {
    client.search(argv.search, opts, function (err, search) {
        search.on('searchEntry', function (entry) {
            var user = entry.object;
            async.each(user.proxyAddresses, function (addr, cb) {
                addr = addr.toLowerCase()
                // Check if the address starts with SMTP:
                if (!addr.indexOf('smtp:') == 1) {
                    // Check if it ends with .local and if we are supposed to ignore .local addresses
                    if (addr.match(/\.local$/) && argv.ignoreLocal) {
                        debug('Skipping local address: ' + addr);
                    } else if ((addr.indexOf('{') !== -1) && argv.filterGarbage) {
                      debug('Skipping garbage address: ' + addr);
                    } else {
                        write_line(addr.substring(addr.indexOf('smtp:') + 5));
                    }
                }
                cb();
            }, function (err) {
                if (err) {
                    debug(err);
                }
            });
        });
        search.on('end', function (result) {
            callback();
        });
    });
}

if (argv.groups) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.err('Unable to connect: ' + err);
      }
      opts.filter = '(|(&(objectCategory=group)(groupType:1.2.840.113556.1.4.804:=8)(!(groupType:1.2.840.113556.1.4.804:=2147483648))(mailNickname=*))(&(objectCategory=group)(groupType:1.2.840.113556.1.4.803:=2147483656)(mailNickname=*))(&(objectCategory=group)(!(groupType:1.2.840.113556.1.4.804:=8))(mailNickname=*))(&(objectCategory=msExchDynamicDistributionList)(mailNickname=*)))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}

if (argv.folders) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.error('Unable to bind: ' + err);
      }
      opts.filter = '(&(objectCategory=publicFolder)(mailNickname=*))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}

if (argv.contacts) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.error('Unable to bind: ' + err);
      }
      opts.filter = '(&(objectClass=contact)(mailNickname=*))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}

if (argv.users) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.error('Unable to bind: ' + err);
      }
      opts.filter = '(&(objectClass=user)(objectCategory=person)(mailNickname=*)(msExchHomeServerName=*))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}

if (argv.rooms) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.error('Unable to bind: ' + err);
      }
      opts.filter = '(&(mailNickname=*)(|(msExchRecipientDisplayType=7)(msExchRecipientDisplayType=-2147481850)))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}

if (argv.mailenabledcontacts) {
  ldap_connect(function (client) {
    client.bind(argv.username, argv.password, function (err) {
      if (err) {
        return console.error('Unable to bind: ' + err);
      }
      opts.filter = '(&(objectClass=user)(targetAddress=*))';
      query_ldap(client, opts, function () {
        client.unbind();
      });
    });
  });
}
