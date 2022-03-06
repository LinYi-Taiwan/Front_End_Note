# 攔截/篩選用戶端的請求資源

### 目錄

1.1 我想解決什麼問題？ <br>
1.2 架構 ＆ 流程 ＆ 使用的工具介紹<br>
1.3 動手做做看<br>
1.4 有點 tricky 的應用<br>
1.5 總結<br>

### 1.1 我想解決什麼問題？

不同 domain 的 API 要一直寫 request URL，真的有點麻煩

1. 我想要統一設定好後，方便管理我的請求方式
2. 我想要做不同 domain 的 config 預處理
3. 我想統一在接到 response 後統一做 status 判斷跳轉
4.  我想節省重複請求相同資源的次數

最一開始想到的方法是給予一個可以重複利用的函式，然後根據不同情境進行宣告、賦值、判斷、呼叫、（回收）：

```js
const apiCaller = (domain) => (params) => {
  return fetchSomething(domain, params);
};
//宣告 domainA、domainB，若之後跟 domainA 相關的 API 都透過 domainA 做呼叫
const domainA = apiCaller("domainA");
const domainB = apiCaller("domainB");
//呼叫
domainA({ params: { userId: 1 } });
domainB({ params: { companyId: 2 } });
```

但這個方法只能最快幫我解決 1.，剩餘的 2.3.4. 都會非常麻煩，所以我想借用 axios，而不自己造輪子

### 1.2 架構流程 ＆ 使用的工具介紹

1. 架構流程

我希望透過攔截的方式，在發送請求、接受資源前都可以再做一次最後的掙扎（？

![](../images/interceptorApply-1.png)

2. 使用的工具介紹

這裡會使用 vue 與 axios 進行實作，vue 只會用到生命週期跟功能的拆分，主要還是著重在 axios 這個工具

axios 中，剛好有一個 interceptor 可以讓我們在發送請求、接受資源前對 config 或是回傳的資料進行處理，
但 axios 裡面還有滿多很好用的 protoType function ，詳情可參考 axios github ～～

### 1.3 動手做做看

解決問題一：我想要統一設定好後，方便管理我的請求方式

我會先宣告一個實例，之後的 API 呼叫都會使用這個 instance

```js
//如果你有不同的 domain，也可以分別宣告，拆分成不同檔案進行呼叫，這裡統一宣告一個實例
const domainA = axios.create({
  baseURL: "domainA/",
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});
```

這樣你就可以分別呼叫、定義你匯入的 API

解決問題二：我想要做不同 domain 的 config 預處理

延續剛剛宣告的 instance，然後宣告 preRequest 來當作發送 API 前的最後一次處理，而這裡的 config 中包含你的 request 組成，你可以在這裡從 GET 改為 POST，也可以修正你的 headers，相當於客製化你的需求

```js
const preRequest = (config) => {
  //do something ...
  return config;
};
const handelError = (err) => {
  return Promise.reject(err);
};

instance.interceptors.request.use(preRequest, handelError);
```

解決問題三：我想統一在接到 response 後統一做 status 判斷跳轉
這裡的操作其實跟問題二很像，你可以在收到資料前就直接做 status 的判斷，不用等到回傳到呼叫的 API 實例就開始動作

```js
const preProcessResponse = (res) => {
    switch(res.status){
        case '500':
            router.push('serverError.vue', params:{msg:res.error.msg})
            break
        ...
    }

};
const handelError = (err) => {
    return Promise.reject(err);
};

instance.interceptors.response.use(preProcessResponse, handelError);
```

### 1.4 有點 tricky 的應用 & 解決問題四：我想節省重複請求相同資源的次數

 其實第四個請求資源也是我覺得最有趣的部分！
前三個問題解決都圍繞在「開發者」，但第四點才是真正的多面向的影響使用者與 server 端，這個問題如果可以解決的話，可以：

1. 降低 server 成本
2. 提高使用者體驗（速度）

但是隱含的缺點可能包含：

1. 記憶體使用變多
2. 若是動態操作，資料流沒定義清楚的話會發生錯誤

流程如下：
![](../images/interceptorApply-2.png)

在這裡我會使用快取的操作範例如下：

```js
// import 已經初始化的 instance

import { instance } from './fetch.js';

data(){
    return {
        url: 'domainA/fakeData'
    }
}
created(){
    const myCache = caches.open('cache');
        instance
            .get(this.url)
            .then(this.processData)
            .catch(this.catchEventHandler);
},

methods:{
    processData({data}){
        // process data
    },
    catchEventHandler(){
        // catch error or other event
    }
}
```

然後在剛剛的 preRequest 中進行 cache 的判斷與處理
步驟如下：

1. 檢查快取中是否已經有相同請求？
2. 若有，則用 axios.CancelToken 的方式「取消請求」，並且回傳「已快取的資料」\*注意：這裡的 res.text() 是一個 promise，res.text() 中的 text 也需要透過 JSON.parse() 去做解析
3. 若沒有，則發送請求，並且將這個請求儲存在快取中

```js
const preRequest = (config) => {
  caches
    .match(config.url)
    .then((res) => {
      if (res) {
        config.cancelToken = new axios.CancelToken((cancel) => {
          cancel(res.text());
        });
      } else {
        instance.get(config.url).then(({ data }) => {
          const myCache = caches.open(`${config.url}`);
          myCache.then((res) => {
            res.put(config.url, new Response(JSON.stringify(data.data)));
          });
        });

        return Promise.resolve("wow");
      }
    })
    .catch((err) => {
      console.log(err);
    });
  return config;
};
```

### 1.5 總結

> 其實 serviceWorker 就可以達到快取的判斷，可以想像他是一個在瀏覽器載入時在背景默默執行的一個線程，所以其實應該更好用，更直覺。 <br>
> reject promise 其實也可以透過 axios 做到很多應用，結合 localStorage 可以做到權限的判斷、更多資料的緩存等等。<br>
> caches 也並非每個瀏覽器都有支援，所以在使用上要先去做 caches in window 的判斷。<br>
> 近幾年 PWA 的支援度已經越來越好，chrome 支援度已經很高，ios 雖然還有很多功能未開啟，但也有漸漸的在做 bug fix，在蘋果社群也常會看到 PWA 的關鍵字，希望未來有更多應用出現～～<br>
