var printErrorInfo =  function(obj){
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
};

module.exports = {
  //name on right side of : gives it a name that can be called within the scope of itself
  fetchRowsFromRS : function fetchRowsFromRS(connection, res, next, resultSet, numRows, dataSet, helper) {
    var parentRes = res;
    var useLoader = (helper.queryOpts && helper.queryOpts.useLoader);
    //Close the resultset out after it has been looped through
    function doClose(connection, resultSet, next) {
      resultSet.close(
        function(err){
          if (err) { 
            console.error(err.message); 
            next(err);
          }

          connection.release(
            function(err){
              if (err) { 
                console.error(err.message); 
                next(err);
              }
            }
          );
        }
      );
    }
    
    resultSet.getRows( // get numRows rows
       numRows,
       function (err, rows){
        if (err) {
          console.error("error in resultSet");
          console.error(err);
          doClose(connection, resultSet); // always close the result set
        } else if (rows.length === 0 || (!helper.validReq && helper.rsRunCount > 0)) {    // no rows, or no more rows
          if(useLoader){
            helper.postLoadFn(dataSet);
          } else {
            parentRes.json(helper.postLoadFn(dataSet));
          }
          
          doClose(connection, resultSet); // always close the result set
        } else if (rows.length > 0) {
          helper.rsRunCount += 1;

          dataSet = helper.loadFn(dataSet,rows);
       
          fetchRowsFromRS(connection, res, next, resultSet, numRows, dataSet, helper);
        }
      }
    );
  },

  runQuery: function(data,req,res,next) {
    var parentRes = res;
    var self = this;
    var isResultSet = (data.queryOpts && data.queryOpts.resultSet);
    var useLoader = (data.queryOpts && data.queryOpts.useLoader);
    // default run count of zero set higher for all sources with restricted access
    if(isResultSet && !data.rsRunCount){
      data.rsRunCount = 0;
    }
    
    req.pool.getConnection(
      function (err, connection) {
        if (err) {
          console.error('Error in establishing connection');
          console.error('Path: ' + req.route.path);
          console.error('Params: ' + printErrorInfo(req.query));
          console.error(err.message);
          if(connection){
            connection.release(
              function (err) {
                if (err) {
                  console.error(err.message);
                  return next(err);
                } else {
                    return next();    
                }
                    
              }
            );
          } else {
            return next();
          }
        }

        connection.execute(
          data.query
          ,data.params
          ,data.queryOpts
          ,function (err, result) {
            if (err) {
              console.error('Error in querying or fetching data');
              console.error('Path: ' + req.route.path);
              console.error('Params: ' + printErrorInfo(req.query));
              console.error(err.message);
              next(err); // Run the error through the next step in the express pipeline
              return;
            } else if (result){
              try{
                if (isResultSet){
                  var dataSet = {};
                  self.fetchRowsFromRS(connection, res, next, result.resultSet, data.queryOpts.prefetchRows, dataSet, data);
                } else {
                  if (useLoader){
                    //assume that the socket is within the loadFn
                    data.loadFn(result);
                    parentRes.send();
                  } else {
                    parentRes.json(data.loadFn(result));
                  }
                }
              } catch(e) {
                console.error('Error in creating or outputting JSON');
                console.error('Path: ' + req.route.path);
                console.error('Params: ' + printErrorInfo(req.query));
                console.error(e.message);
                if (!isResultSet){
                  connection.release(
                    function (err) {
                      if (err) {
                        console.error(err.message);
                        return next(err);
                      } else { 
                        return;
                      }
                    }
                  );
                }
              } finally {
                //only close synchronously if not a result set, as the result set will close its own connection
                if (!isResultSet){
                  connection.release(
                    function (err) {
                      if (err) {
                        console.error(err.message);
                        return next(err);
                      } else { 
                        return;
                      }
                    }
                  );
                }
              }
            }
          }
        );
      }
    );
  }
};