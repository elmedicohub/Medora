(() => {
  "use strict";
  let initializedFor = "";
  let tries = 0;
  function ready() {
    const select = document.getElementById("tripSelect");
    if (select?.value && select.value !== initializedFor) {
      initializedFor = select.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (tries++ < 80) setTimeout(ready, 100);
  }
  setTimeout(ready, 120);
})();
