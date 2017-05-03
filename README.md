## simplequery
### A simple module to streamline using node-oracledb within the routes of an express server to return JSON data

The module is capable of handling both regular queries with a limited maxRows and resultSets, with slight differences in the functions utilized.

##### Get Started
Add to your route file or server js file:
`var query = require('@corpsmap/simplequery');`

##### Regular versus ResultSet
If you think your query will return less than 10,000 rows a regular query is the best fit, and will perform faster as the resultSet has to process the collection of results in chunks. If your query does return more than the allotted maxRows in your query, then it will simply stop at that row count and not return further rows.

##### Usage
Within each route, you will declare a `data` Object with a few required parameters:
* `query`: String of the full query text to be passed to the server will have substitution values marked as :value
* `params`: Object containing the parameters to substitute in the query, the key names in the object must match those in the query.
* `queryOpts`: object containing options for the query execution (`maxrows`, `resultset`, `prefetchRows`, etc.)
  * When the query is a resultSet, it needs to have `resultSet: true`, and a `prefetchRows` value greater than 0
  * When the query is now a resultSet, it needs to only have the `maxRows` specified, and `resultSet` can be passed, the default value is assumed to be false
* `loadFn`:
  * Result Set queries expect a function taking in two parameters, one which is the dataset thus far, and the second the current set of rows from the resultset. The function should then load the row data into the dataset and then after processing, return the dataset
  * Regular queries expect a function that takes one parameter, the result of the query, and should return the final form you wish to have returned from the route, including handling formatting as geoJSON or other format of JSON.
* `postLoadFn`:
  * This is used only for resultSet queries, where the loadFn is used for each subset of the resultSet. The function takes the dataset as a parameter and returns the final form you wish to have returned from the route, including handling formatting as geoJSON or other format of JSON.

#### Regular Query Example
```
    var someParam;
    var data = {
        query: query: "SELECT "+
            "  id "+
            "  ,status "+
            "FROM status_l "+
            "WHERE status = :status "
        ,params : {status: someParam}
        ,queryOpts : {maxRows: maxRows}
        ,loadFn: function(result){
            var retVal = [];

            for (var i = 0; i < result.rows.length; i++) {
                retVal.push({
                    id : result.rows[i][0]
                    ,status : result.rows[i][1]
                });
            }
            
            return {data:retVal};
        }
    };

    query.runQuery(data,req,res,next);
```

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
            return {data:dataSet};
        }
        ,validReq : validateReq.isValid(origin,env)
    };
    query.runQuery(data,req,res,next);
```

##### Limitations
At this time there is no handling of any LOB type columns with the query module.