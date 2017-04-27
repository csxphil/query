## Query
### A simple module to streamline using node-oracledb within the routes of an express server to return JSON data

The module is capable of handling both regular queries with a limited maxRows and resultSets, with slight differences in the functions utilized.

Add to your route file or server js file:
`var query = require('@corpsmap/query');`

Within each route, you will declare a data object with a few required parameters:
* query: String of the full query text to be passed to the server will have substitution values marked as :value
* params: Object containing the parameters to substitute in the query, the key names in the object must match those in the query.
* queryOpts: object containing options for the query execution (maxrows, resultset, prefetchRows, etc.)
  * When the query is a resultset, it needs to have the resultSet option passed as true, and a prefetchRows value greater than 0
  * When the query is a resultset, it needs to only have the maxRows specified, lack of a resultSet option assumes it to be false
* loadFn:
  * Result Set queries expect a function taking in two parameters, one which is the dataset thus far, and the second the current set of rows from the resultset. The function should then load the row data into the dataset and then after processing, return the dataset
  * Regular queries expect a function that takes one parameter, the result of the query, and should return the final form you wish to have returned from the route, including handling formatting as geoJSON or other format of JSON.
* postLoadFn:
  * This is used only for resultSet queries, where the loadFn is used for each subset of the resultSet. The function takes the dataset as a parameter and returns the final form you wish to have returned from the route, including handling formatting as geoJSON or other format of JSON.
* resultSet: tells the query module whether to handle as a regular query or resultSet query, to be removed in a future build

#### Regular Query Example
```
var data = {
        query: "SELECT "+
            "  name "+
            "  ,TO_CHAR(beg_stop_date,pbb_util_api.get_app_date_format) "+
            "  ,TO_CHAR(end_stop_date,pbb_util_api.get_app_date_format) "+
            "  ,reason_code "+
            "  ,stoppage_reason "+
            "FROM( "+
            "  SELECT "+
            "    name "+
            "    ,beg_stop_date "+
            "    ,end_stop_date "+
            "    ,reason_code "+
            "    ,stoppage_reason "+
            "    ,RANK() OVER (PARTITION BY name ORDER BY beg_stop_date DESC) AS rank_ind "+
            "  FROM( "+
            "    SELECT "+
            "      CASE "+
            "        WHEN :division != 'all' THEN lsam.district "+
            "        WHEN :district != 'all' THEN lsam.river_code "+
            "        WHEN :river_code != 'all' AND :lock_no = 'all' THEN lsam.river_code||'-'||lsam.lock_no "+
            "        ELSE lsam.river_code||'-'||lsam.lock_no||'-'||lsam.chmbr_no END AS name "+
            "      ,lsam.beg_stop_date "+
            "      ,lsam.end_stop_date "+
            "      ,lsam.reason_code "+
            "      ,srl.description AS stoppage_reason "+
            "    FROM lock_stoppage_all_mv lsam "+
            "    INNER JOIN stoppage_reason_l srl ON (lsam.reason_code = srl.short_code) "+
            "    WHERE (:division = 'all' OR division = :division) "+
            "    AND (:district = 'all' OR district = :district) "+
            "    AND (:river_code = 'all' OR river_code = :river_code) "+
            "    AND (:lock_no = 'all' OR lock_no = :lock_no) "+
            "    AND (:chmbr_no = 'all' OR chmbr_no = :chmbr_no) "+
            "  ) "+
            ") "+
            "WHERE rank_ind <= 10 "+
            "ORDER BY name, beg_stop_date DESC"
        ,params : {division: division, district: district, river_code: river, lock_no: lock, chmbr_no: chamber}
        ,queryOpts : {maxRows: maxRows}
        ,loadFn: function(result){
            var retVal = {}, obj;

            for (var i = 0; i < result.rows.length; i++) {
                if (typeof obj === 'undefined' || (typeof obj == 'object' && (obj.name != result.rows[i][0]))) {
                    if (typeof obj !== 'undefined') {
                       retVal[obj.name] = obj;
                    } 
                    obj = {
                        name : result.rows[i][0]
                        ,data : [{
                            startDate : result.rows[i][1]
                            ,endDate : result.rows[i][2]
                            ,reasonCode : result.rows[i][3]
                            ,stoppageReason : result.rows[i][4]
                        }]
                    };
                    
                } else {
                    obj.data.push({
                        startDate : result.rows[i][1]
                        ,endDate : result.rows[i][2]
                        ,reasonCode : result.rows[i][3]
                        ,stoppageReason : result.rows[i][4]
                    });
                }
            }

            if(typeof obj !== 'undefined' && typeof obj === 'object'){
                retVal[obj.name] = obj;
            }
            
            return {data:_.values(retVal)};
        }
        ,resultSet : false
    };

    query.runQuery(data,req,res,next);

#### resultSet query example:
```
    var someParam;
    var data = {
        query: "SELECT "+
            "  id "+
            "  ,status "+
            "FROM status_l "+
            "WHERE status = :status "
        ,params : {status: someParam}
        ,queryOpts : {resultSet : true, prefetchRows: validateReq.isValid(origin,env) ? 1000 : 50}
        ,loadFn: function(dataSet, rows){
            for (var i = 0; i < rows.length; i++) {
                dataSet.push({
                    id: rows[i][0]
                    ,status: rows[i][1]
                });
            }
            return dataSet;
        },
        postLoadFn: function(dataSet){
            return {data:_.values(dataSet)};
        }
        ,validReq : validateReq.isValid(origin,env)
        ,resultSet : true
    };
    query.runQuery(data,req,res,next);
```