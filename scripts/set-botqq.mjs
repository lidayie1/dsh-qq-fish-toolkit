import fs from "node:fs";
const p = "<HOME>/.dsh/profiles/desktop/cordis.patch.yml";
let t = fs.readFileSync(p, "utf8");
if (!/botQQ:\s*''/.test(t)) throw new Error("botQQ empty not found");
t = t.replace(/botQQ:\s*''/, "botQQ: '<FISH_QQ>'");
fs.writeFileSync(p, t, "utf8");
console.log("botQQ set");
