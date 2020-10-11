var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var fs = require("fs");
var crypt = require("crypto");
var Koa = require("koa");
var app = new Koa();
app.use(require("koa-static")("./static", { maxage: 86400000 /*1 day*/ }));
app.use(require("koa-bodyparser")());
var Mustache = require("mustache");
var db = require("./db");
db.connect().then(db.initialize).then(function () {
    app.listen(8083);
    console.log("listening on :8083");
});
app.use(function (ctx) { return __awaiter(_this, void 0, void 0, function () {
    var data, _a, hash, hashedip, form_1, votes_1, amount, success, data, _b;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                if (!(ctx.url == "/vote")) return [3 /*break*/, 3];
                _c = {};
                return [4 /*yield*/, db.getVotes()];
            case 1:
                data = (_c.options = _e.sent(), _c);
                _a = ctx;
                return [4 /*yield*/, Mustache.render(fs.readFileSync(__dirname + "vote.html").toString(), data)];
            case 2:
                _a.body = _e.sent();
                return [3 /*break*/, 14];
            case 3:
                if (!(ctx.url == "/submit")) return [3 /*break*/, 10];
                if (ctx.cookies.get("voted-abimotto")) {
                    ctx["throw"](401, "Bereits abgestimmt.\nSchau dir die Ergebnisse an.");
                    return [2 /*return*/];
                }
                hash = crypt.createHash("sha256");
                hash.update(ctx.ip);
                hashedip = hash.digest("hex");
                return [4 /*yield*/, db.hasVoted(hashedip)];
            case 4:
                if (_e.sent()) {
                    ctx["throw"](401, "Bereits abgestimmt.\nSchau dir die Ergebnisse an.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, ctx.request.body];
            case 5:
                form_1 = _e.sent();
                if (!form_1) return [3 /*break*/, 8];
                console.log(form_1);
                if (!form_1.fields["consent"]) {
                    ctx["throw"](406, "Zustimmung nicht gegeben.\nNavigiere bitte zurueck versuche es erneut.");
                    return [2 /*return*/];
                }
                votes_1 = [];
                Object.keys(form_1.fields).forEach(function (fieldkey) {
                    if (fieldkey != "consent" && form_1.fields[fieldkey].startsWith("on")) {
                        votes_1.push(fieldkey);
                    }
                });
                amount = votes_1.length;
                if (amount == 0) {
                    ctx["throw"](400, "Gar keine Optionen ausgewaehlt.\nNavigiere bitte zurueck und versuche es erneut.");
                    return [2 /*return*/];
                }
                if (amount > 5) {
                    ctx["throw"](400, "Zu viele Optionen ausgewaehlt (" + amount + " statt 5 erlaubte).\nNavigiere bitte zurueck und versuche es erneut.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, db.castVotes(votes_1)];
            case 6:
                success = _e.sent();
                if (!success) {
                    ctx["throw"](500, "Interner Fehler beim Speichern der Stimmen.\nKontaktiere bitte den Seitenbetreiber.\nVersuche, zurück zu navigieren und es erneut zu versuchen.");
                    return [2 /*return*/];
                }
                console.log(new Date().toISOString() + ": successful vote submission");
                return [4 /*yield*/, db.noteVoted(hashedip)];
            case 7:
                _e.sent();
                ctx.set("Set-Cookie", "voted-abimotto=true");
                ctx.set("Location", "/results");
                ctx["throw"](302);
                return [3 /*break*/, 9];
            case 8:
                ctx["throw"](400, "Keine Formulardaten.\nNavigiere bitte zurueck und versuche es erneut.");
                _e.label = 9;
            case 9: return [3 /*break*/, 14];
            case 10:
                if (!(ctx.url == "/results")) return [3 /*break*/, 13];
                _d = {};
                return [4 /*yield*/, db.getSortedVotes()];
            case 11:
                data = (_d.options = _e.sent(), _d);
                _b = ctx;
                return [4 /*yield*/, Mustache.render(fs.readFileSync(__dirname + "results.html").toString(), data)];
            case 12:
                _b.body = _e.sent();
                return [3 /*break*/, 14];
            case 13:
                if (ctx.url == "/") {
                    ctx.set("Location", "/results");
                    ctx["throw"](302);
                }
                else {
                    ctx["throw"](404, "404 Not found");
                }
                _e.label = 14;
            case 14: return [2 /*return*/];
        }
    });
}); });
