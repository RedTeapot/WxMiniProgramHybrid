var hybridLib = require("../hybrid-lib/driver.js");

Page({
  onLoad: function (options) {
    hybridLib.onLoad_requestHandlePageInMiniProgram(options);
  }
})