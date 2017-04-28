module.exports = {
	printParams : function(obj){
		if(obj && Object.keys(obj).length > 0 ){
		    var keys = Object.keys(obj);
		    var retString = '';
		    keys.forEach(function(k,i){
		        retString += (retString === '' ? '':', ') + k + ': ' + obj[k];
		    });
		    return retString;
		} else {
		    return 'No Params';
		}
	}
};