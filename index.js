var eventEmitter = require("events").EventEmitter;
var parse = require("irc-message").parse;
var util = require("util");
var webSocket = require("ws");

var ws;

function client(opts) {
    var self = this;

    self.opts = (typeof options !== "undefined") ? options : {};
    self.opts.connection = opts.connection || {};
    self.opts.identity = opts.identity || {};
    self.opts.channels = opts.channels || [];

    self.username = "";

    eventEmitter.call(self);
}

util.inherits(client, eventEmitter);

// Handle parsed message..
client.prototype.handleMessage = function handleMessage(message) {
    var self = this;

    // Messages with no prefix..
    if (message.prefix === null) {
        switch(message.command) {
            // Received PING from server..
            case "PING":
                self.emit("ping");
                ws.send("PONG");
                ws.pong();
                break;

            // Received PONG from server, return current latency
            case "PONG":
                self.emit("pong");
                break;

            default:
                console.log(message);
                break;
        }
    }

    // Messages with "tmi.twitch.tv" as a prefix..
    else if (message.prefix === "tmi.twitch.tv") {
        switch(message.command) {
            case "002":
            case "003":
            case "004":
            case "375":
            case "376":
            case "CAP":
                break;

            // Got username from server..
            case "001":
                self.username = message.params[0];
                break;

            // We are connected to the server..
            case "372":
                self.emit("connected");

                ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");

                loopIterate(self.opts.channels, function (element) {
                    ws.send("JOIN " + element);
                }, 1000);
                break;

            // https://github.com/justintv/Twitch-API/blob/master/chat/capabilities.md#notice
            case "NOTICE":
                var msgid = message.tags["msg-id"] || null;

                switch(msgid) {
                    case "subs_on":
                        // This room is now in subscribers-only mode..
                        break;
                    case "subs_off":
                        // This room is no longer in subscribers-only mode..
                        break;
                    case "slow_on":
                        // This room is now in slow mode. You may send messages every slow_duration seconds..
                        break;
                    case "slow_off":
                        // This room is no longer in slow mode..
                        break;
                    case "r9k_on":
                        // This room is now in r9k mode..
                        break;
                    case "r9k_off":
                        // This room is no longer in r9k mode..
                        break;
                    case "host_on":
                        // Now hosting target_channel..
                        break;
                    case "host_off":
                        // Exited host mode..
                        break;
                }
                break;

            case "HOSTTARGET":
                console.log(message);
                break;

            default:
                console.log(message);
                break;
        }
    }

    // Anything else..
    else {
        switch(message.command) {
            case "353":
            case "366":
                break;

            case "JOIN":
                console.log(message);
                break;

            default:
                console.log(message);
                break;
        }
    }
};

// Connect to server..
client.prototype.connect = function connect() {
    var self = this;

    // TODO: Get a random ws/wss server from Twitch if undefined
    var server = typeof self.opts.connection.server !== "undefined" ? self.opts.connection.server : "192.16.64.145";
    var port = typeof self.opts.connection.port !== "undefined" ? self.opts.connection.port : 443;

    ws = new webSocket("ws://" + server + ":" + port + "/", "irc");

    // Socket is opened..
    ws.onopen = function (event) {
        // Emitting "connecting" event..
        self.emit("connecting", server, port);

        var username = typeof self.opts.identity.username !== "undefined" ? self.opts.identity.username : "justinfan" + Math.floor((Math.random() * 80000) + 1000);
        var password = typeof self.opts.identity.password !== "undefined" ? self.opts.identity.password : "SCHMOOPIIE";

        // Make sure "oauth:" is included..
        if (password !== "SCHMOOPIIE" && password.indexOf("oauth:") < 0) {
            password = "oauth:" + password;
        }

        // Emitting "logon" event..
        self.emit("logon");

        // Authentication..
        ws.send("PASS " + password);
        ws.send("NICK " + username);
        ws.send("USER " + username + " 8 * :" + username);
    };

    // Received message from server..
    ws.onmessage = function(event) {
        self.handleMessage(parse(event.data.replace("\r\n", "")));
    };

    // An error occurred..
    ws.onerror = function (event) {
        console.log(event);
    };

    // Socket connection closed..
    ws.onclose = function (event) {
        console.log(event.reason);
    };
};

// Disconnect from server..
client.prototype.disconnect = function disconnect() {
    if (ws !== null && ws.readyState !== 3) {
        ws.close();
    }
};

// Loop through array..
function loopIterate(array, callback, interval) {
    var start = + new Date();
    if (array.length > 0) { process(); }

    function process() {
        var element = array.shift();
        callback(element, new Date() - start);

        if (array.length > 0) { setTimeout(process, interval); }
    }
}

// Expose everything, for browser and Node.js / io.js
if (typeof window !== "undefined") {
    window.client = client;
} else {
    module.exports = client;
}
