var sqlite3 = require('sqlite3').verbose();
var translationDB = new sqlite3.Database('./translation.sqlite3');
var greekDB = new sqlite3.Database('./str+.sqlite3');

function generateResponse(msg) {
    return {msg};
}

var appRouter = function(app) {

    app.get("/translation/project/list", function(req, res) {
        res.send("Hello World");
    });

    app.post("/translation", function(req, res) {
        res.send(generateResponse("OK"));
    });

    app.get("/verses/:book", function(req, res) {

        let book_number    = req.params.book;
        // chapter_number = greekDB.params.chapter;
        
        let sql = "select * from verses where book_number = ? order by chapter";

        greekDB.all(sql, book_number, (err, rows) => {

            if(!err) {
                res.send({
                    data: rows
                });     
            } else {
                res.send({
                    err: err
                });
            }
        });
        
    });

    app.get("/book/list", function(req, res) {
        
            // chapter_number = greekDB.params.chapter;
            
            let sql = "select * from books";
            
            // console.log("error");

            greekDB.all(sql, (err, rows) => {
                // console.log(rows);
                if(!err) {
                    res.send({
                        data: rows
                    });     
                } else {
                    res.send({
                        err: err
                    });
                }
            }); 
    });
        
}
    
module.exports = appRouter;