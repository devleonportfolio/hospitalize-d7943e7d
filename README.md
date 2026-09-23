# Hospitalize — app Android e iOS

Projeto gerado pelo Leon Apps. Ele abre **https://gestao.hospitalize.com.br/** dentro de um app nativo
(Capacitor) com as funções do celular que você escolheu.

## O que você precisa

- Node.js 20 ou superior
- Android Studio (para gerar o APK/AAB)
- Um Mac com Xcode (para gerar o app iOS) — exigência da Apple
- Contas de desenvolvedor: Google Play (uma vez, US$ 25) e Apple (US$ 99/ano)

## Passo a passo

```bash
npm install
npx capacitor-assets generate      # cria ícones e splash a partir de resources/
npm run add:android
npm run add:ios                     # somente no Mac
npm run sync
npm run open:android                # abre o Android Studio
npm run open:ios                    # abre o Xcode
```

No Android Studio: menu **Build > Generate Signed Bundle / APK**.
No Xcode: menu **Product > Archive**.

Sempre que mudar algo, rode `npm run sync` de novo.

## Build na nuvem (sem Android Studio / sem Mac)

No Leon Apps, a aba "Build na nuvem" faz tudo sozinha: cria o repositório, envia estes
arquivos e inicia a build. Você não precisa de Android Studio nem de Mac.

Sem chave de assinatura sai um **APK de teste** (Android) e um app iOS **sem
assinatura** — bons para testar no aparelho, mas não aceitos pelas lojas.

Para publicar nas lojas, use a aba **Assinatura** do Leon Apps:

1. **Android**: clique em "Criar chave de assinatura" (ou envie a sua). A build passa a
   gerar o **.aab** assinado para a Google Play, além do APK. Baixe o arquivo da chave e
   guarde junto com a senha — é ele que permite enviar atualizações do app depois.
2. **iPhone**: envie o certificado de distribuição (`.p12`) e o perfil de provisionamento
   (`.mobileprovision`) da sua conta Apple Developer (US$ 99/ano). A build passa a gerar o
   **.ipa** assinado para a App Store.

Na build, a chave chega como variável de ambiente (`CM_KEYSTORE`, `CM_KEYSTORE_PASSWORD`,
`CM_KEY_ALIAS`, `CM_KEY_PASSWORD`, `CM_CERTIFICATE`, `CM_CERTIFICATE_PASSWORD`,
`CM_PROVISIONING_PROFILE`) e o script `scripts/apply-signing.mjs` liga a assinatura ao
projeto Android.


## Ícone e splash

O arquivo `resources/icon.png` já veio com o seu ícone. O comando `npx capacitor-assets generate` cria todos os tamanhos exigidos pelas lojas.

## Funções que todo app já vem com elas

`AppNative.toast`, `AppNative.haptics` (vibração), `AppNative.dialog` (alerta,
confirmação, pergunta), `AppNative.clipboard`, `AppNative.device` (modelo, bateria,
idioma), `AppNative.app` (versão, botão voltar, app em segundo plano, fechar),
`AppNative.keyboard`, `AppNative.statusBar`, `AppNative.orientation`,
`AppNative.storage`, `AppNative.openUrl`, `AppNative.isOnline` e
`AppNative.onNetworkChange`.

## Abrir arquivos em outros apps

```js
await AppNative.files.open("https://seusite.com/contrato.pdf");   // lista de apps
await AppNative.files.open(url, { usarAppPadrao: true });          // abre direto
await AppNative.files.openWith(url);                               // folha "Abrir com…"
await AppNative.files.saveAndOpen("nota.txt", base64, "text/plain");
await AppNative.download(url, "arquivo.pdf", { open: true });
```

Funciona com PDF, vídeo, áudio, imagem, planilha, zip e qualquer outro tipo:
o Android mostra a lista de apps capazes de abrir aquele formato e o iOS abre
a folha de documentos do sistema.

## Permissões e políticas das lojas

- Só são declaradas as permissões das funções que você ativou.
- Sem `QUERY_ALL_PACKAGES`: a visibilidade de apps usa `<queries>` com as
  intenções necessárias (exigência do Google Play desde o Android 11).
- Sem `WRITE_EXTERNAL_STORAGE`/`MANAGE_EXTERNAL_STORAGE`: os downloads ficam
  na pasta do próprio app (armazenamento com escopo).
- Fotos da galeria usam o seletor do Android, sem pedir acesso a todas as fotos.
- No iOS, cada permissão vem com o texto de justificativa no `Info.plist`,
  obrigatório na revisão da App Store.
- Ao publicar, preencha o formulário de Segurança dos Dados (Google Play) e o
  Nutrition Label de privacidade (App Store) de acordo com o que o seu site coleta.

## Funções nativas ativadas

- **Câmera e galeria** — `AppNative.camera.takePhoto()`
- **Geolocalização** — `AppNative.location.current()`
- **Biometria** — `AppNative.biometrics.verify()`
- **Downloads de arquivos** — `AppNative.download(url, nomeDoArquivo)`
- **Deep links / links universais** — `AppNative.onDeepLink(callback)`
- **Abrir arquivos em outros apps** — `AppNative.files.open(url)`

Cole esta linha no HTML do seu site (antes de `</body>`):

```html
<script src="http://localhost:8080/api/public/bridge/d7943e7d-44f7-4586-9220-cd9baa89b5ee.js"></script>
```

Esse endereço é servido pelo Leon Apps e acompanha as funções que você ativar.
Se preferir hospedar você mesmo, use o arquivo `bridge/app-native.js` desta pasta.


Exemplo no seu site:

```js
if (window.AppNative?.isApp) {
  const foto = await AppNative.camera.takePhoto();
  console.log(foto.dataUrl);
}
```

## Deep links

O domínio `https://gestao.hospitalize.com.br/` já está configurado no Android. Para o iOS,
ative **Associated Domains** no Xcode com `applinks:https://gestao.hospitalize.com.br/` e publique
os arquivos `/.well-known/assetlinks.json` e `/.well-known/apple-app-site-association`
no seu site.

## Configuração aplicada

- Identificador: `app.hospitalize.com`
- Orientação: retrato
- Tela cheia: não
- Modo offline: sim (tela própria sem internet)
- Links externos no navegador: sim
- Puxar para atualizar: sim
