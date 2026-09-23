#!/usr/bin/env node
/* Aplica as permissões e ajustes nativos depois de "npx cap add". */
import fs from "node:fs";
import path from "node:path";

const cfg = JSON.parse(fs.readFileSync("config/native.json", "utf8"));

function patchAndroid() {
  const manifestPath = "android/app/src/main/AndroidManifest.xml";
  if (!fs.existsSync(manifestPath)) return console.log("Android ainda não adicionado, pulando.");
  let xml = fs.readFileSync(manifestPath, "utf8");

  for (const perm of cfg.androidPermissions) {
    if (!xml.includes(perm)) {
      xml = xml.replace("</manifest>", `    <uses-permission android:name="${perm}" />\n</manifest>`);
    }
  }

  const orientation = cfg.orientation === "any" ? "fullSensor" : cfg.orientation;
  xml = xml.replace(/android:screenOrientation="[^"]*"/g, "");
  xml = xml.replace(/(<activity[^>]*android:name="\.MainActivity")/, `$1\n            android:screenOrientation="${orientation}"`);

  if (cfg.deeplinkHost) {
    const intent = `
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${cfg.deeplinkHost}" />
            </intent-filter>`;
    if (!xml.includes(cfg.deeplinkHost)) {
      xml = xml.replace("</activity>", `${intent}\n        </activity>`);
    }
  }

  // Android 11+: para abrir arquivos em apps de terceiros (PDF, vídeo, planilha...)
  // o app precisa enxergar quem sabe abrir cada tipo. Usamos <queries> com as
  // intenções necessárias — QUERY_ALL_PACKAGES é reprovado pelo Google Play.
  if (cfg.androidQueries && !xml.includes("<queries>")) {
    const queries = `    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:mimeType="*/*" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SEND" />
            <data android:mimeType="*/*" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.media.action.IMAGE_CAPTURE" />
        </intent>
    </queries>`;
    xml = xml.replace("</manifest>", `${queries}\n</manifest>`);
  }

  fs.writeFileSync(manifestPath, xml);
  console.log("AndroidManifest.xml atualizado.");
}

function patchIos() {
  const plistPath = path.join("ios", "App", "App", "Info.plist");
  if (!fs.existsSync(plistPath)) return console.log("iOS ainda não adicionado, pulando.");
  let plist = fs.readFileSync(plistPath, "utf8");

  for (const item of cfg.iosUsageDescriptions) {
    if (!plist.includes(item.key)) {
      plist = plist.replace("</dict>", `    <key>${item.key}</key>\n    <string>${item.value}</string>\n</dict>`);
    }
  }

  const orientations = cfg.orientation === "landscape"
    ? ["UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]
    : cfg.orientation === "portrait"
      ? ["UIInterfaceOrientationPortrait"]
      : ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"];
  const block = "    <key>UISupportedInterfaceOrientations</key>\n    <array>\n" +
    orientations.map((o) => `        <string>${o}</string>`).join("\n") + "\n    </array>";
  if (plist.includes("<key>UISupportedInterfaceOrientations</key>")) {
    plist = plist.replace(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>[\s\S]*?<\/array>/, block.trim());
  } else {
    plist = plist.replace("</dict>", block + "\n</dict>");
  }

  if (cfg.fullscreen && !plist.includes("UIStatusBarHidden")) {
    plist = plist.replace("</dict>", "    <key>UIStatusBarHidden</key>\n    <true/>\n</dict>");
  }

  // Arquivos salvos pelo app aparecem no app Arquivos do iPhone e podem ser
  // abertos/compartilhados com outros aplicativos.
  if (cfg.iosFileSharing) {
    for (const key of ["UIFileSharingEnabled", "LSSupportsOpeningDocumentsInPlace"]) {
      if (!plist.includes(key)) {
        plist = plist.replace("</dict>", `    <key>${key}</key>\n    <true/>\n</dict>`);
      }
    }
  }

  fs.writeFileSync(plistPath, plist);
  console.log("Info.plist atualizado.");
}

patchAndroid();
patchIos();
