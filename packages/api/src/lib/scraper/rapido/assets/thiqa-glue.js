
export async function instantiate(imports={}, runInitializer=true) {
    const cachedJsObjects = new WeakMap();
    // ref must be non-null
    function getCachedJsObject(ref, ifNotCached) {
        if (typeof ref !== 'object' && typeof ref !== 'function') return ifNotCached;
        const cached = cachedJsObjects.get(ref);
        if (cached !== void 0) return cached;
        cachedJsObjects.set(ref, ifNotCached);
        return ifNotCached;
    }

    const _ref_QGpzLWpvZGEvY29yZQ_ = imports['@js-joda/core'];

    const wasmJsTag = WebAssembly.JSTag;
    const wasmTag = wasmJsTag ?? new WebAssembly.Tag({ parameters: ['externref'] });

    const js_code = {
        'kotlin.createJsError' : (message, cause) => new Error(message, { cause }),
        'kotlin.wasm.internal.jsThrow' : typeof wasmJsTag !== 'undefined' && wasmTag === wasmJsTag ? (e) => { throw e; } : () => {},
        'kotlin.wasm.internal.stringLength' : (x) => x.length,
        'kotlin.wasm.internal.jsExportStringToWasm' : (src, srcOffset, srcLength, dstAddr) => { 
            const mem16 = new Uint16Array(wasmExports.memory.buffer, dstAddr, srcLength);
            let arrayIndex = 0;
            let srcIndex = srcOffset;
            while (arrayIndex < srcLength) {
                mem16.set([src.charCodeAt(srcIndex)], arrayIndex);
                srcIndex++;
                arrayIndex++;
            }     
             },
        'kotlin.wasm.internal.importStringFromWasm' : (address, length, prefix) => { 
            const mem16 = new Uint16Array(wasmExports.memory.buffer, address, length);
            const str = String.fromCharCode.apply(null, mem16);
            return (prefix == null) ? str : prefix + str;
             },
        'kotlin.wasm.internal.getJsEmptyString' : () => '',
        'kotlin.wasm.internal.externrefToString' : (ref) => String(ref),
        'kotlin.wasm.internal.externrefEquals' : (lhs, rhs) => lhs === rhs,
        'kotlin.wasm.internal.externrefHashCode' : 
        (() => {
        const dataView = new DataView(new ArrayBuffer(8));
        function numberHashCode(obj) {
            if ((obj | 0) === obj) {
                return obj | 0;
            } else {
                dataView.setFloat64(0, obj, true);
                return (dataView.getInt32(0, true) * 31 | 0) + dataView.getInt32(4, true) | 0;
            }
        }
        
        const hashCodes = new WeakMap();
        function getObjectHashCode(obj) {
            const res = hashCodes.get(obj);
            if (res === undefined) {
                const POW_2_32 = 4294967296;
                const hash = (Math.random() * POW_2_32) | 0;
                hashCodes.set(obj, hash);
                return hash;
            }
            return res;
        }
        
        function getStringHashCode(str) {
            var hash = 0;
            for (var i = 0; i < str.length; i++) {
                var code  = str.charCodeAt(i);
                hash  = (hash * 31 + code) | 0;
            }
            return hash;
        }
        
        return (obj) => {
            if (obj == null) {
                return 0;
            }
            switch (typeof obj) {
                case "object":
                case "function":
                    return getObjectHashCode(obj);
                case "number":
                    return numberHashCode(obj);
                case "boolean":
                    return obj ? 1231 : 1237;
                default:
                    return getStringHashCode(String(obj)); 
            }
        }
        })(),
        'kotlin.wasm.internal.isNullish' : (ref) => ref == null,
        'kotlin.wasm.internal.getJsTrue' : () => true,
        'kotlin.wasm.internal.getJsFalse' : () => false,
        'kotlin.wasm.internal.getCachedJsObject_$external_fun' : (p0, p1) => getCachedJsObject(p0, p1),
        'kotlin.js.jsCatch' : (f) => { 
            let result = null;
            try { 
                f();
            } catch (e) {
               result = e;
            }
            return result;
             },
        'kotlin.js.__convertKotlinClosureToJsClosure_(()->Unit)' : (f) => getCachedJsObject(f, () => wasmExports['__callFunction_(()->Unit)'](f, )),
        'kotlin.js.jsThrow' : (e) => { throw e; },
        'kotlin.io.printlnImpl' : (message) => console.log(message),
        'kotlin.io.printError' : (error) => console.error(error),
        'kotlin.js.stackPlaceHolder_js_code' : () => (''),
        'kotlin.js.message_$external_prop_getter' : (_this) => _this.message,
        'kotlin.js.name_$external_prop_setter' : (_this, v) => _this.name = v,
        'kotlin.js.stack_$external_prop_getter' : (_this) => _this.stack,
        'kotlin.js.kotlinException_$external_prop_getter' : (_this) => _this.kotlinException,
        'kotlin.js.kotlinException_$external_prop_setter' : (_this, v) => _this.kotlinException = v,
        'kotlin.js.JsError_$external_class_instanceof' : (x) => x instanceof Error,
        'kotlin.js.Promise_$external_fun' : (p0) => new Promise(p0),
        'kotlin.js.__callJsClosure_((Js?)->Unit)' : (f, p0) => f(p0),
        'kotlin.js.__callJsClosure_((Js)->Unit)' : (f, p0) => f(p0),
        'kotlin.js.__convertKotlinClosureToJsClosure_((((Js?)->Unit),((Js)->Unit))->Unit)' : (f) => getCachedJsObject(f, (p0, p1) => wasmExports['__callFunction_((((Js?)->Unit),((Js)->Unit))->Unit)'](f, p0, p1)),
        'kotlin.js.__convertKotlinClosureToJsClosure_((Js?)->Js?)' : (f) => getCachedJsObject(f, (p0) => wasmExports['__callFunction_((Js?)->Js?)'](f, p0)),
        'kotlin.js.then_$external_fun' : (_this, p0, p1) => _this.then(p0, p1),
        'kotlin.js.__convertKotlinClosureToJsClosure_((Js)->Js?)' : (f) => getCachedJsObject(f, (p0) => wasmExports['__callFunction_((Js)->Js?)'](f, p0)),
        'kotlin.random.initialSeed' : () => ((Math.random() * Math.pow(2, 32)) | 0),
        'kotlin.wasm.internal.getJsClassName' : (jsKlass) => jsKlass.name,
        'kotlin.wasm.internal.instanceOf' : (ref, jsKlass) => ref instanceof jsKlass,
        'kotlin.wasm.internal.getConstructor' : (obj) => obj.constructor,
        'kotlin.time.Date_$external_fun' : () => new Date(),
        'kotlin.time.getTime_$external_fun' : (_this, ) => _this.getTime(),
        'kotlin.time.tryGetPerformance' : () => typeof globalThis !== 'undefined' && typeof globalThis.performance !== 'undefined' ? globalThis.performance : null,
        'kotlin.time.getPerformanceNow' : (performance) => performance.now(),
        'kotlin.time.dateNow' : () => Date.now(),
        'kotlin.uuid.cryptoGetRandomValues' : (size) => crypto.getRandomValues(new Int8Array(size)),
        'kotlin.uuid.get' : (array, index) => array[index],
        'kotlinx.coroutines.tryGetProcess' : () => (typeof(process) !== 'undefined' && typeof(process.nextTick) === 'function') ? process : null,
        'kotlinx.coroutines.tryGetWindow' : () => (typeof(window) !== 'undefined' && window != null && typeof(window.addEventListener) === 'function') ? window : null,
        'kotlinx.coroutines.nextTick_$external_fun' : (_this, p0) => _this.nextTick(p0),
        'kotlinx.coroutines.error_$external_fun' : (_this, p0) => _this.error(p0),
        'kotlinx.coroutines.console_$external_prop_getter' : () => console,
        'kotlinx.coroutines.createScheduleMessagePoster' : (process) => () => Promise.resolve(0).then(process),
        'kotlinx.coroutines.__callJsClosure_(()->Unit)' : (f, ) => f(),
        'kotlinx.coroutines.createRescheduleMessagePoster' : (window) => () => window.postMessage('dispatchCoroutine', '*'),
        'kotlinx.coroutines.subscribeToWindowMessages' : (window, process) => {
            const handler = (event) => {
                if (event.source == window && event.data == 'dispatchCoroutine') {
                    event.stopPropagation();
                    process();
                }
            }
            window.addEventListener('message', handler, true);
        },
        'kotlinx.coroutines.setTimeout_$external_fun' : (p0, p1) => setTimeout(p0, p1),
        'kotlinx.coroutines.promiseSetDeferred' : (promise, deferred) => promise.deferred = deferred,
        'co.touchlab.kermit.consoleError' : (output) => console.error(output),
        'co.touchlab.kermit.consoleWarn' : (output) => console.warn(output),
        'co.touchlab.kermit.consoleInfo' : (output) => console.info(output),
        'co.touchlab.kermit.consoleLog' : (output) => console.log(output),
        'com.rapido.thiqa.jsResultSuccess' : (xM, xKm, xEkref, xPm) => ({ success: true, xM: xM, xKm: xKm, xEkref: xEkref, xPm: xPm }),
        'com.rapido.thiqa.jsResultError' : (message) => ({ success: false, error: message }),
        'com.rapido.thiqa.internal.crypto.subtleDigest' : (algorithm, data) => crypto.subtle.digest(algorithm, data),
        'com.rapido.thiqa.internal.crypto.subtleImportKey' : (format, keyData, algorithm, extractable, usages) => crypto.subtle.importKey(format, keyData, algorithm, extractable, usages),
        'com.rapido.thiqa.internal.crypto.subtleSign' : (algorithm, key, data) => crypto.subtle.sign(algorithm, key, data),
        'com.rapido.thiqa.internal.crypto.subtleEncrypt' : (algorithm, key, data) => crypto.subtle.encrypt(algorithm, key, data),
        'com.rapido.thiqa.internal.crypto.subtleDecrypt' : (algorithm, key, data) => crypto.subtle.decrypt(algorithm, key, data),
        'com.rapido.thiqa.internal.crypto.createUint8Array' : (size) => new Uint8Array(size),
        'com.rapido.thiqa.internal.crypto.newUint8ArrayFromBuffer' : (buffer) => new Uint8Array(buffer),
        'com.rapido.thiqa.internal.crypto.fillRandomValues' : (array) => crypto.getRandomValues(array),
        'com.rapido.thiqa.internal.crypto.getUint8ArrayElement' : (array, index) => array[index],
        'com.rapido.thiqa.internal.crypto.setUint8ArrayElement' : (array, index, value) => array[index] = value,
        'com.rapido.thiqa.internal.crypto.uint8ArrayLength' : (array) => array.length,
        'com.rapido.thiqa.internal.crypto.hmacAlgorithm' : (hash) => ({ name: 'HMAC', hash: { name: hash } }),
        'com.rapido.thiqa.internal.crypto.aesCbcAlgorithm' : (iv) => ({ name: 'AES-CBC', iv: iv }),
        'com.rapido.thiqa.internal.crypto.jsArrayOf' : (item) => [item],
        'com.rapido.thiqa.internal.provider.getHostname' : () => window.location.hostname
    }
    
    // Placed here to give access to it from externals (js_code)
    let wasmInstance;
    let require; 
    let wasmExports;

    const isNodeJs = (typeof process !== 'undefined') && (process.release.name === 'node');
    const isDeno = !isNodeJs && (typeof Deno !== 'undefined')
    const isStandaloneJsVM =
        !isDeno && !isNodeJs && (
            typeof d8 !== 'undefined' // V8
            || typeof inIon !== 'undefined' // SpiderMonkey
            || typeof jscOptions !== 'undefined' // JavaScriptCore
        );
    const isBrowser = !isNodeJs && !isDeno && !isStandaloneJsVM && (typeof window !== 'undefined' || typeof self !== 'undefined');
    
    if (!isNodeJs && !isDeno && !isStandaloneJsVM && !isBrowser) {
      throw "Supported JS engine not detected";
    }

    const wasmFilePath = './platform-mobile-sdks-thiqa-kmp.wasm';

    const importObject = {
        js_code,
        intrinsics: {
            tag: wasmTag
        },

    };
    
    try {
      if (isNodeJs) {
        const module = await import(/* webpackIgnore: true */'node:module');
        const importMeta = import.meta;
        require = module.default.createRequire(importMeta.url);
        const fs = require('fs');
        const url = require('url');
        const filepath = import.meta.resolve(wasmFilePath);
        const wasmBuffer = fs.readFileSync(url.fileURLToPath(filepath));
        const wasmModule = new WebAssembly.Module(wasmBuffer);
        wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
      }
      
      if (isDeno) {
        const path = await import(/* webpackIgnore: true */'https://deno.land/std/path/mod.ts');
        const binary = Deno.readFileSync(path.fromFileUrl(import.meta.resolve(wasmFilePath)));
        const module = await WebAssembly.compile(binary);
        wasmInstance = await WebAssembly.instantiate(module, importObject);
      }
      
      if (isStandaloneJsVM) {
        const wasmBuffer = read(wasmFilePath, 'binary');
        const wasmModule = new WebAssembly.Module(wasmBuffer);
        wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
      }
      
      if (isBrowser) {
        wasmInstance = (await WebAssembly.instantiateStreaming(fetch(new URL('./platform-mobile-sdks-thiqa-kmp.wasm',import.meta.url).href), importObject)).instance;
      }
    } catch (e) {
      if (e instanceof WebAssembly.CompileError) {
        let text = `Please make sure that your runtime environment supports the latest version of Wasm GC and Exception-Handling proposals.
For more information, see https://kotl.in/wasm-help
`;
        if (isBrowser) {
          console.error(text);
        } else {
          const t = "\n" + text;
          if (typeof console !== "undefined" && console.log !== void 0) 
            console.log(t);
          else 
            print(t);
        }
      }
      throw e;
    }
    
    wasmExports = wasmInstance.exports;
    if (runInitializer) {
        wasmExports._initialize();
    }

    return { instance: wasmInstance,  exports: wasmExports };
}
