let app = new Vue({
  el: "#app",
  data() {
    return {
      img: [],
      url: "https://fakeimg.pl/350x200/?text=",
      options: {
        threshold: 0.5,
      },
    };
  },
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
  mounted() {
    const images = this.$refs["img"];
    const imgObserver = new IntersectionObserver(this.callback, this.options);
    images.forEach((image) => {
      imgObserver.observe(image);
    });
  },
});
