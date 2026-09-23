// Injeta a configuração de assinatura no projeto Android (executado na build).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const gradlePath = "android/app/build.gradle";
if (!existsSync(gradlePath)) {
  console.log("Projeto Android ainda não existe, nada a fazer.");
  process.exit(0);
}

let gradle = readFileSync(gradlePath, "utf8");
if (gradle.includes("keystorePropertiesFile")) {
  console.log("Assinatura já configurada.");
  process.exit(0);
}

const header = `def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

`;
gradle = header + gradle;

const signingConfigs = `
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeType keystoreProperties['storeType'] ?: "JKS"
            }
        }
    }
`;
gradle = gradle.replace(/android\s*\{/, (match) => match + signingConfigs);

gradle = gradle.replace(
  /buildTypes\s*\{\s*release\s*\{/,
  (match) => match + "\n            signingConfig signingConfigs.release",
);

writeFileSync(gradlePath, gradle);
console.log("Assinatura configurada em android/app/build.gradle");
