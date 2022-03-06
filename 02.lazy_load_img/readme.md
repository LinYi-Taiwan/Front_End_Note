# 使用 intersection observer 進行圖片的 lazy load

### 目錄

1.1 我想解決什麼問題？ <br>
1.2 架構 ＆ 流程 ＆ 使用的工具介紹<br>
1.3 總結<br>

### 1.1 我想解決什麼問題？

網頁的渲染速度和很多原因有關，例如：

1. 用戶網速、硬體
2. js 執行順序
   等等...

而通常佔用下載資源的其中一個大宗就是：圖片

要怎麼從圖片來改善用戶體驗（網頁速度優化）呢？我們可以：

1. 不要仔入用戶目前用不到的資訊
2. 圖片大小的控制（依照裝置、壓縮圖片體積等...）

### 1.2 架構 ＆ 流程 ＆ 使用的工具

步驟一：
選擇要監聽的 dom，這裡是 img tag，並且初始化 intersection observer 這個函數

```js
// 小提醒：要在 mounted 而不是 created 做是因為，mounted 才是 dom 正式被掛載的生命週期
  mounted() {
    const images = this.$refs["img"];
    const imgObserver = new IntersectionObserver(this.callback, this.options);
    images.forEach((image) => {
      imgObserver.observe(image);
    });
  },
```

步驟二：
寫好 callback function （當監聽被觸發時要做的事）
p.s. options 有很多種設定，可以依照自己想要的情境去做調整

```js
  methods: {
    preloadImage(img) {
      img.children[0].src = img.children[0].dataset.src;
    },
    callback(entries, imgObserver) {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        } else {
          this.preloadImage(entry.target);
          imgObserver.unobserve(entry.target);
        }
      });
    },
  },
```

### 1.2 總結

> 瀑布流圖片、文章其實都是差不多的概念，只是使用 intersection observer 這個函數效能會比較好，因為傳統的監聽方式會不斷重複計算 <br>
