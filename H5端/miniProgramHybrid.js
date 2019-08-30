/**
 * 对象序列化
 * @param {Object} data 要序列化的对象
 * @returns {String}
 */
var serialize = function (data) {
  var s = "";
  for (var p in data)
	s += "&" + p + "=" + encodeURIComponent(data[p]).replace(/\+/gm, "%2B");
  s = s.length > 0 ? s.substring(1) : s;

  return s;
};

/**
 * 生成随机字符串
 * @param {String} [prefix=""] 前缀
 * @param {Number} [len=10] 除前缀外，要随机生成的字符串的长度
 * @returns {String}
 */
var randomString = (function(){
	var i = 0, tailLength = 2;
	var alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

	var getTail = function(){
		var s = (i++).toString(36);
		if(i > Math.pow(16, tailLength))
			i = 0;

		return s.substring(s.length - tailLength);
	};

	return function(prefix, len){
		if(arguments.length < 2)
			len = 10;
		if(arguments.length < 1)
			prefix = "";

		var minLen = tailLength + 1;
		if(len < minLen)
			throw new Error("Length should not be little than " + minLen);
		len -= tailLength;

		var str = "";
		while(len-- > 0){
			var index = Math.floor(Math.random() * alphabet.length);
			str += alphabet.charAt(index);
		}

		return prefix + str + getTail();
	};
})();


var currentReq = null,
	currentCallback = null;

/**
 * 调用微信小程序
 * @param {String} api 业务指令
 * @param {Object} params 业务参数
 * @param {Function} [callback] 处理回调
 */
var callMiniProgram = function(api, params, callback){
	currentReq = randomString("H5Req_");
	currentCallback = typeof callback === "function"? callback: null;
	
	wx.miniProgram.navigateTo({
		url: "/pages/hybrid-page/hybrid?" + serialize({
			cmd: JSON.stringify({
				req: currentReq,
				api: api,
				params: params
			})
		})
	});
};

window.addEventListener("hashchange", function(e){
	if(null == currentReq)
		return;
	
	if(!location.hash.startsWith("#" + currentReq + "="))
		return;
	
	var params = {};
	location.hash.substring(1).split("&").forEach(function(pair){
		var tmp = pair.split("=");
		if(tmp.length < 1)
			return;
		
		params[decodeURIComponent(tmp[0].trim())] = decodeURIComponent(tmp[1].trim());
	});
	
	var result = params[currentReq];
	if(typeof currentCallback !== "function"){
		console.log(currentReq + " -> " + result);
	}else
		currentCallback(result);
});

window.miniProgramHybrid = {
	call: callMiniProgram
};