var sqlite3 = require('sqlite3').verbose();
var translationDB = new sqlite3.Database('./translation.sqlite3');
var greekDB = new sqlite3.Database('./str+.sqlite3');

function getOpenProject() {
    
    return new Promise((resolve, reject)=>{
        let sql = "select project from open_project where id = 1";
        
            translationDB.get(sql, (err, row) => {
                // console.log(rows);
                if(!err) {
                    resolve(row);        
                } else {
                    reject(err);
                }
            });
    });
}

function processWord(req) {
    
    return new Promise((resolve, reject)=> {

        let sql = "select id from word where value = ?";
        
        translationDB.get(sql, req.body.word, (err, row) => {
            // console.log(rows);
            if(!err) {

                if(!row) {

                    translationDB.run("INSERT INTO word(value) values(?)", req.body.word, function(err2) {
                        
                        if(!err2) {
                            resolve(this.lastID);  
                        } else {
                            reject(err2);
                        }

                    });

                } else {
                    resolve(row.id);
                }

            } else {
                reject(err);
            }
        });

    });
}

function createGrammarEntry(gramID, translaId) {
    return new Promise((res, rej)=>{

        translationDB.run("INSERT INTO grammar_entry(grammar_id, translation_id) VALUES(?,?)", [
            gramID,
            translaId
        ], function(err) {
            if(err)
                rej(err);
            else
                res(this.lastID);
        });

    });
}

function associateGrammar(grammars, translaId) {
    
    return new Promise((resolve1, reject1) => {

        grammars = grammars.filter( (val) => {
            return val.name != null && val.name.length > 0;
        });

        let definitions = [];

        let sql = "select * from grammar where definition in (";

        grammars.forEach( (val, index) => {
            sql += "'" + val.name + "'";
            if(grammars.length > 1 && index < grammars.length-1) {
                sql += ",";
            }
        });

        sql += ")";

        translationDB.each(sql, (err, row) => {
            
            definitions.push(row);
            
        }, (err) => {
            
            console.error(err);

            let sql = "select * from grammar_entry where translation_id = ?";
            
            let promises = [];

            grammars.forEach( (val, index) => {
                promises.push(new Promise((resolve, reject) => {
                    
                    translationDB.get("SELECT * FROM grammar WHERE definition = ?", val.name, 
                    function(err, row) {
                        if(row) {
                            createGrammarEntry(row.id, translaId).then(()=>{
                                resolve();
                            });
                        } else {
                            translationDB.run("INSERT INTO grammar(definition) VALUES(?)", val.name, function(err) {
                                createGrammarEntry(this.lastID, translaId).then(()=>{
                                    resolve();
                                });
                            });
                        }
                    });

                }));//end promi array
            }); //end for each

            Promise.all(promises).then((res) => {
                resolve1();
            });

        });
    });
}

function generateResponse(msg) {
    return {msg};
}

var appRouter = function(app) {

    app.get("/translation/project/list", function(req, res) {
            
            let sql = "select * from project";

            translationDB.all(sql, (err, rows) => {

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

    app.post("/translation/project", function(req, res) {

        translationDB.run("INSERT INTO PROJECT(name) VALUES(?)", req.body.name, function(err) {
            console.log(this.lastID);

            if(!err) {
                translationDB.run("DELETE FROM open_project WHERE id = ?", 1, () => {
                    translationDB.run("INSERT INTO open_project(id, project) values(?,?)", 1, this.lastID, (err) => {
                        
                        let sql = "select project from open_project where id = 1";
                        
                        translationDB.get(sql, (err, row) => {
                            res.send(row);
                        });

                    });
                });
                
                
            } else {
                res.send({
                    err: err
                });
            }

        });

    });

    app.post("/translation/project/open", function(req, res) {

        translationDB.run("DELETE FROM open_project where id = 1");
        translationDB.run("INSERT INTO open_project(id, project) values(?,?)", 1, 
        req.body.id, function(err) {
            console.error(err);
        });

        res.send({data: "OK"});
    });

    // app.get("/translation/:book/:chapter/:verse/:order/list", function(req, res) {

    //     let sql = "select * from translation where book = ? and chapter = ? and verse = ? and word_order = ?";
        
    //     translationDB.all(sql, [
    //         req.params.book,
    //         req.params.chapter,
    //         req.params.verse,
    //         req.params.order
    //     ], (err, row) => {
    //         // console.log(rows);
    //         if(!err) {
    //             res.send({data: "OK"});
    //         } else {
    //             res.send([]);
    //         }
    //     });        
    // });

    app.get("/translation/:book/:chapter/:verse/:order", function(req, res) {

        let sql = "select project from open_project where id = 1";
        
        translationDB.get(sql, (err, project) => {

            let sql = "select * from translation where book = ? and chapter = ? and verse = ? and word_order = ? and project_id = ?";
            
            translationDB.get(sql, [
                req.params.book,
                req.params.chapter,
                req.params.verse,
                req.params.order,
                project
            ], (err, row) => {

                if(!err) {
                    res.send({data: row});
                } else {
                    res.send([]);
                }
            }); 

        });
       
    });

    app.get("/translation/by/chapter/:book/:chapter/list", function(req, res) {

        getOpenProject().then((projID)=>{
            
            let sql = `select * from translation 
            where book = ? 
            and chapter = ?
            and project_id = ?
            order by verse, word_order asc `;
            
            let pars = [
                req.params.book,
                req.params.chapter,
                projID.project
            ];

            // console.log(pars);

            translationDB.all(sql, pars, (err, row) => {
                
                if(!err) {
                    res.send({data: row});
                } else {
                    console.error(err);
                    res.send([]);
                }
            });

        });
    });  

    // app.put("/translation", function(req, res) {
    // });

    app.post("/translation", function(req, res) {
        
        if(req.body.id != -1) {
            // getOpenProject().then(() => {
                translationDB.run(`UPDATE translation 
                SET note = ?, 
                    value = ?
                WHERE id = ?`, 
                [req.body.note,
                    req.body.value,
                    req.body.id
                ], function(err) {
    
                    translationDB.run(`DELETE FROM grammar_entry WHERE translation_id = ${req.body.id}`,
                    function(err) {
                        
                        if(req.body.grammarTags) {
                            
                            associateGrammar(req.body.grammarTags, req.body.id).then(() => {
    
                                res.send({data: "OK"});
    
                            });
                        }
    
                    });
    
                });
            // });
        } else {

            let sql = "select project from open_project where id = 1";
            let lastTranslationID = null;

            translationDB.get(sql, (err, row) => {
                // console.log(rows);
                if(!err) {
    
                    processWord(req).then((wordID)=>{
                        
                        translationDB.run("INSERT INTO translation(word_id, note, word_order, project_id, book, chapter, verse, value) values(?,?,?,?,?,?,?,?)", [
                            wordID,
                            req.body.note, 
                            req.body.wordOrder,
                            row.project,
                            req.body.book,
                            req.body.chapter,
                            req.body.verse,
                            req.body.value
                        ], function (err) {

                            lastTranslationID = this.lastID;
                            console.log(err);
    
                            if(req.body.grammarTags) {
                                associateGrammar(req.body.grammarTags, lastTranslationID).then(() => {
    
                                    res.send({data: lastTranslationID});
    
                                });
                            }     
        
                        }); 
    
                    });//END process word
    
                } else {
                    res.send({
                        err: err
                    });
                }
            });
        }

    });    

    app.get("/verses/:book/:chapter", function(req, res) {

        let book_number    = req.params.book;
        let chapter    = req.params.chapter;
        
        let sql = "select * from verses where book_number = ? and chapter = ? order by chapter";

        greekDB.all(sql, [book_number, chapter], (err, rows) => {

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

    app.get("/book/:num/chapters", function(req, res) {
        
            const book_number = req.params.num;
            
            let sql = "select max(chapter) as chapters from verses where book_number = " + book_number;
            
            // console.log("error");

            greekDB.get(sql, (err, row) => {
                // console.log(rows);
                if(!err) {
                    res.send({
                        data: row
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

    app.get("/grammar/:transid/list", function(req, res) {
        
            // chapter_number = greekDB.params.chapter;
            
            let sql = "select * from grammar g, grammar_entry e where g.id = e.grammar_id and e.translation_id = ?";
            
            // console.log("error");

            translationDB.all(sql, req.params.transid, (err, rows) => {
                // console.log(rows);
                if(!err) {
                    res.send({
                        data: rows
                    });     
                } else {
                    console.error(err);
                    res.send({
                        err: err
                    });
                }
            }); 
    });     
    
    //select max(chapter) from verses where book_number = 670
}
    
module.exports = appRouter;