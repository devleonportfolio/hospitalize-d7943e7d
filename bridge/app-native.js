/* AppNative — ponte entre o seu site e as funções nativas do app.
 * Inclua este arquivo no seu site:  <script src="/app-native.js"></script>
 * Tudo aqui só funciona dentro do app; no navegador comum isApp === false.
 */
(function () {
  var Cap = window.Capacitor;
  var isApp = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var P = (Cap && Cap.Plugins) || {};

  function need(name) {
    if (!isApp) throw new Error("Esta função só funciona dentro do app: " + name);
    if (!P[name]) throw new Error("Função nativa indisponível: " + name + " (plugin não instalado no app; gere o app de novo)");
    return P[name];
  }

  function baixarPorFetch(FS, url, name) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function () {
          var base64 = String(reader.result).split(",")[1];
          resolve(FS.writeFile({ path: name, data: base64, directory: "DOCUMENTS" }));
        };
        reader.readAsDataURL(blob);
      });
    });
  }

  var TIPOS = {
    pdf: "application/pdf", txt: "text/plain", csv: "text/csv", rtf: "application/rtf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", apk: "application/vnd.android.package-archive", epub: "application/epub+zip",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska", webm: "video/webm", "3gp": "video/3gpp",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", aac: "audio/aac"
  };

  function nomeDaUrl(url) {
    var limpo = String(url).split("?")[0].split("#")[0];
    return decodeURIComponent(limpo.split("/").pop() || "") || "arquivo";
  }

  function mimeDoNome(nome, padrao) {
    var ext = String(nome).split(".").pop().toLowerCase();
    return TIPOS[ext] || padrao || "application/octet-stream";
  }

  // Baixa o arquivo para a pasta do próprio app (sem permissão de armazenamento)
  // e devolve o caminho nativo (uri) pronto para abrir ou compartilhar.
  function baixarArquivo(url, fileName, directory) {
    var FS = need("Filesystem");
    var name = fileName || nomeDaUrl(url);
    var dir = directory || "DOCUMENTS";
    if (String(url).indexOf("data:") === 0 || !FS.downloadFile) {
      return baixarPorFetch(FS, url, name).then(function (r) {
        return { uri: r && r.uri, path: name, mimeType: mimeDoNome(name) };
      });
    }
    return FS.downloadFile({ url: url, path: name, directory: dir })
      .catch(function () { return baixarPorFetch(FS, url, name); })
      .then(function (r) { return { uri: r && (r.uri || r.path), path: name, mimeType: mimeDoNome(name) }; });
  }


  var AppNative = {
    isApp: isApp,
    platform: isApp ? Cap.getPlatform() : "web",

    // Barra de status e splash
    hideSplash: function () { return isApp && P.SplashScreen ? P.SplashScreen.hide() : Promise.resolve(); },

    // Rede
    isOnline: function () {
      return isApp && P.Network ? P.Network.getStatus().then(function (s) { return s.connected; })
        : Promise.resolve(navigator.onLine);
    },
    onNetworkChange: function (cb) {
      if (!isApp || !P.Network) {
        var on = function () { cb(navigator.onLine); };
        window.addEventListener("online", on); window.addEventListener("offline", on);
        return function () { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
      }
      var h = P.Network.addListener("networkStatusChange", function (s) { cb(s.connected); });
      return function () { Promise.resolve(h).then(function (x) { x.remove(); }); };
    },

    // Vibração / feedback tátil
    haptics: {
      impact: function (style) { return need("Haptics").impact({ style: style || "MEDIUM" }); },
      notification: function (type) { return need("Haptics").notification({ type: type || "SUCCESS" }); },
      vibrate: function (ms) { return need("Haptics").vibrate({ duration: ms || 300 }); },
      selection: function () { return need("Haptics").selectionStart(); }
    },

    // Mensagem rápida nativa
    toast: function (text, duration) {
      return need("Toast").show({ text: String(text), duration: duration || "short" });
    },

    // Caixas de diálogo nativas
    dialog: {
      alert: function (message, title) { return need("Dialog").alert({ title: title || "", message: String(message) }); },
      confirm: function (message, title) {
        return need("Dialog").confirm({ title: title || "", message: String(message) })
          .then(function (r) { return !!r.value; });
      },
      prompt: function (message, title) {
        return need("Dialog").prompt({ title: title || "", message: String(message) })
          .then(function (r) { return r.cancelled ? null : r.value; });
      }
    },

    // Área de transferência
    clipboard: {
      write: function (text) { return need("Clipboard").write({ string: String(text) }); },
      read: function () { return need("Clipboard").read().then(function (r) { return r.value; }); }
    },

    // Informações do aparelho
    device: {
      info: function () { return need("Device").getInfo(); },
      id: function () { return need("Device").getId().then(function (r) { return r.identifier || r.uuid; }); },
      battery: function () { return need("Device").getBatteryInfo(); },
      language: function () { return need("Device").getLanguageCode().then(function (r) { return r.value; }); }
    },

    // Ciclo de vida do app
    app: {
      info: function () { return need("App").getInfo(); },
      exit: function () { return need("App").exitApp(); },
      minimize: function () { return need("App").minimizeApp ? need("App").minimizeApp() : Promise.resolve(); },
      onBackButton: function (cb) {
        if (!isApp || !P.App) return function () {};
        var h = P.App.addListener("backButton", function (e) { cb(e); });
        return function () { Promise.resolve(h).then(function (x) { x.remove(); }); };
      },
      onStateChange: function (cb) {
        if (!isApp || !P.App) return function () {};
        var h = P.App.addListener("appStateChange", function (s) { cb(s.isActive); });
        return function () { Promise.resolve(h).then(function (x) { x.remove(); }); };
      }
    },

    // Teclado
    keyboard: {
      hide: function () { return isApp && P.Keyboard ? P.Keyboard.hide() : Promise.resolve(); },
      show: function () { return isApp && P.Keyboard ? P.Keyboard.show() : Promise.resolve(); },
      onResize: function (cb) {
        if (!isApp || !P.Keyboard) return function () {};
        var a = P.Keyboard.addListener("keyboardWillShow", function (i) { cb(i.keyboardHeight); });
        var b = P.Keyboard.addListener("keyboardWillHide", function () { cb(0); });
        return function () {
          Promise.resolve(a).then(function (x) { x.remove(); });
          Promise.resolve(b).then(function (x) { x.remove(); });
        };
      }
    },

    // Barra de status
    statusBar: {
      setColor: function (hex) { return need("StatusBar").setBackgroundColor({ color: hex }); },
      setStyle: function (style) { return need("StatusBar").setStyle({ style: style || "DARK" }); },
      hide: function () { return need("StatusBar").hide(); },
      show: function () { return need("StatusBar").show(); }
    },

    // Orientação da tela
    orientation: {
      current: function () { return need("ScreenOrientation").orientation().then(function (r) { return r.type; }); },
      lock: function (type) { return need("ScreenOrientation").lock({ orientation: type || "portrait" }); },
      unlock: function () { return need("ScreenOrientation").unlock(); }
    },

    // Armazenamento nativo (fica salvo mesmo limpando o cache do site)
    storage: {
      set: function (key, value) { return need("Preferences").set({ key: key, value: JSON.stringify(value) }); },
      get: function (key) {
        return need("Preferences").get({ key: key }).then(function (r) {
          try { return r.value === null ? null : JSON.parse(r.value); } catch (e) { return r.value; }
        });
      },
      remove: function (key) { return need("Preferences").remove({ key: key }); },
      clear: function () { return need("Preferences").clear(); }
    },

    // Abrir link no navegador do sistema / navegador interno
    openUrl: function (url) {
      if (isApp && P.Browser) return P.Browser.open({ url: url });
      window.open(url, "_blank");
      return Promise.resolve();
    },

    share: function (opts) { return need("Share").share(opts || {}); },
    camera: {
      takePhoto: function (opts) {
        return need("Camera").getPhoto(Object.assign(
          { quality: 80, resultType: "dataUrl", source: "CAMERA" }, opts || {}));
      },
      pickImage: function (opts) {
        return need("Camera").getPhoto(Object.assign(
          { quality: 80, resultType: "dataUrl", source: "PHOTOS" }, opts || {}));
      },
      // Converte o resultado da câmera em um File pronto para upload
      toFile: function (photo, fileName) {
        var dataUrl = photo && (photo.dataUrl || photo);
        return fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (b) {
          var ext = (photo && photo.format) || "jpeg";
          return new File([b], fileName || ("foto." + ext), { type: b.type || ("image/" + ext) });
        });
      },
      // Tira/escolhe a foto e coloca dentro de um <input type="file"> do seu site
      attachTo: function (input, opts) {
        var src = (opts && opts.source) === "PHOTOS" ? "pickImage" : "takePhoto";
        var self = AppNative.camera;
        return self[src](opts).then(function (photo) {
          return self.toFile(photo, opts && opts.fileName);
        }).then(function (file) {
          var el = typeof input === "string" ? document.querySelector(input) : input;
          if (!el) throw new Error("Campo de arquivo não encontrado");
          var dt = new DataTransfer();
          dt.items.add(file);
          el.files = dt.files;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return file;
        });
      },
      // Tira/escolhe a foto e envia direto para o seu servidor
      upload: function (url, opts) {
        var o = opts || {};
        var self = AppNative.camera;
        var src = o.source === "PHOTOS" ? "pickImage" : "takePhoto";
        return self[src](o).then(function (photo) {
          return self.toFile(photo, o.fileName);
        }).then(function (file) {
          var form = new FormData();
          form.append(o.field || "file", file, file.name);
          if (o.fields) Object.keys(o.fields).forEach(function (k) { form.append(k, o.fields[k]); });
          return fetch(url, { method: "POST", body: form, headers: o.headers || {}, credentials: o.credentials || "include" });
        }).then(function (res) {
          return res.json().catch(function () { return { status: res.status, ok: res.ok }; });
        });
      }
    },
    location: {
      current: function () { return need("Geolocation").getCurrentPosition({ enableHighAccuracy: true }); },
      watch: function (cb) { return need("Geolocation").watchPosition({ enableHighAccuracy: true }, cb); }
    },
    biometrics: {
      available: function () { return need("BiometricAuth").checkBiometry(); },
      verify: function (reason) {
        return need("BiometricAuth").authenticate({ reason: reason || "Confirme sua identidade" })
          .then(function () { return true; })
          .catch(function () { return false; });
      }
    },
    scanner: {
      scan: function () {
        var S = need("BarcodeScanner");
        return S.requestPermissions().then(function () { return S.scan(); })
          .then(function (r) { return (r.barcodes && r.barcodes[0] && r.barcodes[0].rawValue) || null; });
      }
    },
    push: {
      // "firebase" = FCM/APNs direto pelo Capacitor; "onesignal" = SDK do OneSignal
      provider: "firebase",
      oneSignalAppId: "",

      register: function (onToken, onMessage) {
        if (AppNative.push.provider === "onesignal") {
          return AppNative.push.onesignal.init(onToken, onMessage);
        }
        var Push = need("PushNotifications");
        return Push.requestPermissions().then(function (res) {
          if (res.receive !== "granted") return null;
          if (onToken) Push.addListener("registration", function (t) { onToken(t.value); });
          if (onMessage) Push.addListener("pushNotificationReceived", onMessage);
          return Push.register();
        });
      },

      // ---- OneSignal ----
      onesignal: {
        sdk: function () {
          return window.OneSignal || (window.plugins && window.plugins.OneSignal) || null;
        },
        init: function (onToken, onMessage, appId) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          var id = appId || AppNative.push.oneSignalAppId;
          if (!id) return Promise.reject(new Error("Informe o App ID do OneSignal."));
          if (!OS.__iniciado) { OS.initialize(id); OS.__iniciado = true; }
          if (onMessage && OS.Notifications) {
            OS.Notifications.addEventListener("foregroundWillDisplay", function (e) {
              onMessage((e && e.notification) || e);
            });
            OS.Notifications.addEventListener("click", function (e) {
              onMessage((e && e.notification) || e);
            });
          }
          var sub = OS.User && OS.User.pushSubscription;
          if (sub && sub.addEventListener) {
            sub.addEventListener("change", function (ev) {
              var novo = ev && ev.current && ev.current.id;
              if (novo && onToken) onToken(novo);
            });
          }
          return OS.Notifications.requestPermission(true).then(function (aceito) {
            if (!aceito) return null;
            var atual = (OS.User && OS.User.pushSubscription && OS.User.pushSubscription.id) || null;
            if (atual && onToken) onToken(atual);
            return atual;
          });
        },
        // ID de inscrição (o "token" que você usa para enviar para um aparelho)
        id: function () {
          var OS = AppNative.push.onesignal.sdk();
          var sub = OS && OS.User && OS.User.pushSubscription;
          return Promise.resolve((sub && sub.id) || null);
        },
        // Liga a inscrição ao usuário do seu site (external id)
        login: function (usuarioId) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.login(String(usuarioId)));
        },
        logout: function () {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.logout());
        },
        addTag: function (chave, valor) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.addTag(String(chave), String(valor)));
        },
        addTags: function (tags) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.addTags(tags || {}));
        },
        removeTag: function (chave) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.removeTag(String(chave)));
        },
        setEmail: function (email) {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.addEmail(String(email)));
        },
        optIn: function () {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.pushSubscription.optIn());
        },
        optOut: function () {
          var OS = AppNative.push.onesignal.sdk();
          if (!OS) return Promise.reject(new Error("OneSignal não está instalado neste app."));
          return Promise.resolve(OS.User.pushSubscription.optOut());
        }
      },
      // Notificação local (aparece no aparelho sem precisar de servidor)
      notify: function (title, body, seconds) {
        var LN = need("LocalNotifications");
        return LN.requestPermissions().then(function () {
          return LN.schedule({
            notifications: [{
              id: Math.floor(Math.random() * 100000),
              title: String(title || ""),
              body: String(body || ""),
              schedule: seconds ? { at: new Date(Date.now() + seconds * 1000) } : undefined
            }]
          });
        });
      }
    },
    download: function (url, fileName, opts) {
      var o = opts || {};
      return baixarArquivo(url, fileName, o.directory).then(function (res) {
        if (o.open) return AppNative.files.openLocal(res.uri, res.mimeType).then(function () { return res; });
        return res;
      });
    },
    // Abrir arquivos em apps de terceiros (PDF, vídeo, planilha, qualquer tipo)
    files: {
      mimeType: function (nomeOuUrl) { return mimeDoNome(nomeDaUrl(nomeOuUrl)); },

      // Baixa (se for um link) e abre; o Android mostra a lista de apps capazes
      // de abrir aquele tipo de arquivo, o iOS mostra a folha de abrir/compartilhar.
      open: function (url, opts) {
        var o = opts || {};
        var ehLocal = /^(file:|content:|\/)/.test(String(url));
        if (ehLocal) return AppNative.files.openLocal(url, o.mimeType, o);
        return baixarArquivo(url, o.fileName, o.directory).then(function (res) {
          return AppNative.files.openLocal(res.uri, o.mimeType || res.mimeType, o)
            .then(function () { return res; });
        });
      },

      // Abre um arquivo que já está no aparelho.
      openLocal: function (uri, mimeType, opts) {
        var o = opts || {};
        var FO = P.FileOpener;
        var tipo = mimeType || mimeDoNome(nomeDaUrl(uri));
        if (FO && FO.open) {
          return FO.open({
            filePath: String(uri),
            contentType: tipo,
            // false = mostra a lista de apps; true = abre direto no app padrão
            openWithDefault: o.usarAppPadrao === true
          }).catch(function (e) {
            var m = String((e && e.message) || e);
            if (/no app|activity|handler/i.test(m)) {
              throw new Error("Nenhum app instalado consegue abrir este arquivo (" + tipo + ").");
            }
            throw e;
          });
        }
        // Sem o plugin: tenta a folha de compartilhamento como alternativa.
        return AppNative.files.openWith(uri, tipo);
      },

      // Folha nativa "Abrir com / Compartilhar": sempre lista os apps disponíveis.
      openWith: function (url, mimeType) {
        var Share = need("Share");
        var ehLocal = /^(file:|content:|\/)/.test(String(url));
        var p = ehLocal
          ? Promise.resolve({ uri: url, mimeType: mimeType || mimeDoNome(nomeDaUrl(url)) })
          : baixarArquivo(url, null, "CACHE");
        return p.then(function (res) {
          return Share.share({ title: nomeDaUrl(res.uri), files: [res.uri] });
        });
      },

      // Salva um conteúdo do site (base64 ou texto) e já abre no app escolhido.
      saveAndOpen: function (fileName, base64, mimeType) {
        var FS = need("Filesystem");
        return FS.writeFile({ path: fileName, data: base64, directory: "DOCUMENTS" })
          .then(function (r) { return AppNative.files.openLocal(r.uri, mimeType || mimeDoNome(fileName)); });
      }
    },
    onDeepLink: function (cb) {
      if (!isApp || !P.App) return function () {};
      var h = P.App.addListener("appUrlOpen", function (e) { cb(e.url); });
      return function () { h.then(function (x) { x.remove(); }); };
    },
    purchases: {
      configure: function (apiKey, appUserId) {
        return need("Purchases").configure({ apiKey: apiKey, appUserID: appUserId || null });
      },
      isConfigured: function () {
        return Promise.resolve(need("Purchases").isConfigured ? need("Purchases").isConfigured() : false)
          .then(function (r) { return !!(r && (r.isConfigured !== undefined ? r.isConfigured : r)); });
      },
      offerings: function () {
        return need("Purchases").getOfferings().catch(function (e) {
          var m = String((e && e.message) || e);
          if (m.indexOf("configure") !== -1) {
            throw new Error("Compras ainda não configuradas: chame AppNative.purchases.configure(\"SUA_CHAVE_REVENUECAT\") antes.");
          }
          throw e;
        });
      },
      buy: function (packageToBuy) { return need("Purchases").purchasePackage({ aPackage: packageToBuy }); },
      restore: function () { return need("Purchases").restorePurchases(); }
    },
  };

  // Links externos abrem no navegador do sistema
  if (isApp && P.Browser) {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return;
      if (new URL(href, location.href).host === location.host) return;
      e.preventDefault();
      P.Browser.open({ url: href });
    }, true);
  }

  window.AppNative = AppNative;
  if (isApp && P.SplashScreen) {
    window.addEventListener("load", function () { setTimeout(function () { P.SplashScreen.hide(); }, 300); });
  }
})();
