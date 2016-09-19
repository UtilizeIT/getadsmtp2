#!/usr/bin/env node

var async = require('async');
var debug = require('debug')('getadsmtp'), name = 'getadsmtp';
var argv = require('yargs')
    .usage('Usage: $0 [options]')
    .help('h')
    .alias('h', 'help')
    .demand(['username', 'password', 'server'])
    .describe('username', 'LDAP username')
    .describe('password', 'LDAP password')
    .describe('server', 'LDAP server in the format ldaps://my.server.tld')
    .describe('groups', 'Include group addresses')
    .describe('folders', 'Include public folder addresses')
    .describe('contacts', 'Include addresses from contacts')
    .describe('users', 'Include addresses from users with mailboxes')
    .describe('rooms', 'Include rooms')
    .describe('haraka-rcpt-to-routes', 'Output in Haraka rcpt_to.routes format, requires specifying the URI for delivery')
    .describe('mailenabledcontacts', '')
    .requiresArg('haraka-rcpt-to-routes')
    .argv;

var ldap = require('ldapjs');



function ldap_connect(callback) {
    var client = ldap.createClient({
        url: argv.server,
        tlsOptions: { 'rejectUnauthorized': false }
    });
    callback(client);
};
 
var opts = {
    attributes: ['dn', 'proxyAddresses'],
    scope: 'sub'
};

function write_line(data) {
    if (argv.harakaRcptToRoutes) {
        console.log(data.toLowerCase() + '=' + argv.harakaRcptToRoutes.toLowerCase());
    } else {
        console.log(data);
    }
}

function query_ldap(client, opts, callback) {
    client.search('DC=smiles,DC=local', opts, function (err, search) {
        search.on('searchEntry', function (entry) {
            var user = entry.object;
            async.each(user.proxyAddresses, function (addr, cb) {
                if (!addr.indexOf('SMTP:') == 1) {
                    write_line(addr.substring(addr.indexOf('SMTP:') + 5));
                } else {
                    debug('Skipping: ' + addr);
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
            opts.filter = '(|(&(objectCategory=group)(groupType:1.2.840.113556.1.4.804:=8)(!(groupType:1.2.840.113556.1.4.804:=2147483648))(mailNickname=*))(&(objectCategory=group)(groupType:1.2.840.113556.1.4.803:=2147483656)(mailNickname=*))(&(objectCategory=group)(!(groupType:1.2.840.113556.1.4.804:=8))(mailNickname=*))(&(objectCategory=msExchDynamicDistributionList)(mailNickname=*)))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}

if (argv.folders) {
    ldap_connect(function (client) {
        client.bind(argv.username, argv.password, function (err) {
            opts.filter = '(&(objectCategory=publicFolder)(mailNickname=*))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}

if (argv.contacts) {
    ldap_connect(function (client) {
        client.bind(argv.username, argv.password, function (err) {
            opts.filter = '(&(objectClass=contact)(mailNickname=*))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}

if (argv.users) {
    ldap_connect(function (client) {
        client.bind(argv.username, argv.password, function (err) {
            opts.filter = '(&(objectClass=user)(objectCategory=person)(mailNickname=*)(msExchHomeServerName=*))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}
 
if (argv.rooms) {
    ldap_connect(function (client) {
        client.bind(argv.username, argv.password, function (err) {
            opts.filter = '(&(mailNickname=*)(|(msExchRecipientDisplayType=7)(msExchRecipientDisplayType=-2147481850)))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}

if (argv.mailenabledcontacts) {
    ldap_connect(function (client) {
        client.bind(argv.username, argv.password, function (err) {
            opts.filter = '(&(objectClass=user)(targetAddress=*))'
            query_ldap(client, opts, function () {
                client.unbind();
            });
        });
    });
}
