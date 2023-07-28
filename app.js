const express = require('express')
const path = require('path')
const mysql = require('mysql')
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const {NULL} = require("mysql/lib/protocol/constants/types");
const Errors = require("mysql/lib/protocol/constants/errors");
const _ = require("lodash");
const {isEmpty} = require("lodash");
const hljs = require('highlight.js')


const routers = express.Router()

const app = express()

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adam@1063',
    database: 'cs262_proj'
})

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());

app.use(session({
    secret: '123456catr',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 60000}
}))

app.use(flash());

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, './public/index.html'))
})

app.get('/insert', (req, res) => {
    res.status(200).render('insert', {
        temp: ''
    })
})

app.post('/insert', (req, res) => {
    console.log(req.body)
    const table = req.body.tableList
    connection.query('select * from ' + table, (err, rows, fields) => {
        if (err) throw err

        res.status(200).render('insert', {
            temp: table,
            columns: fields
        })
    })
})

app.post('/insert/table', async (req, res) => {
    //TODO: Check for invalid data

    console.log(req.query)
    console.log(req.body)
    const table = req.query.name
    const tuple = req.body

    let query = 'insert into ' + table + '('
    for (let attr in tuple) {
        query += attr.toString() + ','
    }

    query = query.slice(0, query.length - 1)
    query += ') values('
    for (let attr in tuple) {
        query += ' ?,'
    }
    query = query.slice(0, query.length - 1)
    query += ');'

    console.log('query is : ', query)

    connection.query('desc ' + table, (err, rows, fields) => {
        if (err) console.log('some error')

        let insertArray = []

        for (let i = 0; i < rows.length; i++) {
            const type = rows[i].Type.toString().slice(0, 3).toString()
            if (type === 'int') {
                if (isNaN(parseInt(tuple[rows[i].Field]))) {
                    insertArray.push(null)
                } else
                    insertArray.push(parseInt(tuple[rows[i].Field]))
            } else if (type === 'dec') {
                if (isNaN(parseFloat(tuple[rows[i].Field])))
                    insertArray.push(null)
                else
                    insertArray.push(parseFloat(tuple[rows[i].Field]))
            } else if (type === 'dat') {
                if (tuple[rows[i].Field] === '')
                    insertArray.push(null)
                else
                    insertArray.push(tuple[rows[i].Field])
            } else insertArray.push(tuple[rows[i].Field])
        }


        console.log(insertArray)

        connection.query(query, insertArray, (e, r, f) => {
            if (e) {
                console.log('some error in insertion : ', e)
                const errorMsg = e.message.toString().split(' ')

                if (errorMsg[0] === 'ER_DUP_ENTRY:') {
                    let msg = errorMsg[1] + ' ' + errorMsg[2] + ' ' + errorMsg[3]
                    for (let i = 4; i < errorMsg.length; i++) {
                        if (errorMsg[i] === 'for') break;
                        msg += ' ' + errorMsg[i]
                    }
                    res.status(200).send(msg)
                } else res.status(200).send('Error 404: Problem while inserting data!')
            } else {
                connection.query('select * from ' + table, (er, row, col) => {
                    let no = -1
                    console.log(row)
                    console.log(insertArray)
                    for (let i = 0; i < row.length; i++) {
                        let j = 0;
                        let found = true
                        for (let info in row[i]) {
                            console.log(row[i][info], '  ', insertArray[j])
                            if (info === 'DOB' && row[i][info] !== null) {
                                console.log(row[i][info].toDateString(), '  ', insertArray[j])
                                if (Date.parse(row[i][info].toDateString()) !== Date.parse(new Date(insertArray[j]).toDateString())) {
                                    found = false
                                    break
                                }
                            } else if (row[i][info] !== insertArray[j]) {
                                found = false
                                break
                            }
                            j++
                        }
                        if (found) {
                            no = i
                            break
                        }
                    }
                    console.log(no)
                    res.status(200).render('see', {
                        name: table.toString().toLocaleUpperCase(),
                        someData: row,
                        columns: col,
                        highlightNo: no
                    })
                })
            }
        })
    })
})

app.get('/update', (req, res) => {
    res.status(200).render('update', {
        temp: '',
        attribute: '',
        column: ''
    })
})

app.post('/update', (req, res) => {
    console.log(req.body)
    const table = req.body.tableList

    connection.query('desc ' + table, (err, rows, fields) => {
        if (err) throw err
        let primaryKeys = []
        let nonPrimaryKeys = []
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].Key === 'PRI') {
                primaryKeys.push({
                    name: rows[i].Field
                })
            } else {
                nonPrimaryKeys.push({
                    name: rows[i].Field
                })
            }
        }
        res.status(200).render('update', {
            temp: table,
            columns: nonPrimaryKeys,
            column: primaryKeys,
            attribute: ''
        })
    })
})


app.post('/update/table', (req, res) => {
    const table = req.query.name;
    const tables_col = req.query.attr;
    const {value, attr} = req.body;

    if (tables_col === '') {
        connection.query('desc ' + table, (err, rows, fields) => {
            let primaryKeys = []
            let nonPrimaryKeys = []
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].Key === 'PRI') {
                    primaryKeys.push({
                        name: rows[i].Field
                    })
                } else {
                    nonPrimaryKeys.push({
                        name: rows[i].Field
                    })
                }
            }
            res.status(200).render('update', {
                temp: table,
                columns: nonPrimaryKeys,
                column: primaryKeys,
                attribute: attr
            })
        })
    } else {

        const temp = req.body;

        let primaryKeys = []
        for (let key in temp) {
            if (key !== 'attr' && key !== 'value')
                primaryKeys.push(key)
        }

        const values = [value]

        let query = 'update ' + table + ' SET ' + tables_col + ' =?  where ';
        for (let i = 0; i < primaryKeys.length; i++) {
            query += primaryKeys[i].toString() + '=? and'
            values.push(temp[primaryKeys[i]])
        }
        query = query.slice(0, query.length - 4)

        connection.query(query, values, (err, row, field) => {
            if (err) {
                console.log(err);
                res.send('An error occurred while updating')
            } else {
                console.log('record is updated');

                connection.query('select * from ' + table, (er, rows, fields) => {
                    let no = -1
                    for (let i = 0; i < rows.length; i++) {
                        let found = true
                        for (let j = 0; j < primaryKeys.length; j++) {
                            if (rows[i][primaryKeys[j]].toString() !== req.body[primaryKeys[j]].toString()) {
                                found = false
                                break
                            }
                            if (found) {
                                no = i
                                break
                            }
                        }
                    }

                    res.status(200).render('see', {
                        name: table.toString().toLocaleUpperCase(),
                        someData: rows,
                        columns: fields,
                        highlightNo: no
                    })
                })
            }
        })
    }

});


app.get('/delete', (req, res) => {
    res.status(200).render('delete', {
        temp: '',
        columns: '',
        error: ''
    })
})

app.post('/delete', (req, res) => {
    // console.log(req.body)
    const table = req.body.tableList

    connection.query('desc ' + table, (err, rows, fields) => {
        if (err) res.send('Error 404: Error while deleting')
        else {
            let primaryKeys = []
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].Key === 'PRI')
                    primaryKeys.push({
                        name: rows[i].Field
                    })
            }
            res.status(200).render('delete', {
                temp: table,
                columns: primaryKeys,
                error: ''
            })
        }
    })
})

app.post('/delete/table', (req, res) => {

    //TODO: Checking for valid primary key values
    //TODO: Checking if key value doesn't exist
    //TODO: Cascading on deletion if exists

    const table = req.query.name
    const keyVal = req.body
    // console.log(table)
    // console.log(keyVal)
    let query = 'delete from ' + table + ' where '
    for (let key in keyVal) {
        query += key + ' = \'' + keyVal[key] + '\' and '
    }
    query = query.slice(0, query.length - 4)
    // console.log(query)

    connection.query(query, (err, rows, fields) => {
        if (err) {
            console.log(err)
            res.status(200).render('delete', {
                error: 'Some error occurred while deleting'
            })
        } else res.redirect('/see/query?tablelist=' + table)
    })
})

app.get('/search', (req, res) => {
    res.status(200).render('search', {
        temp: '',
        columns: '',
        attributes: '',
        message: '',
        attrs: '',
        someData: ''
    })
})

app.post('/search', (req, res) => {
    // console.log(req.body)
    // console.log(req.query)
    const table = req.body.tableList

    connection.query('desc ' + table, (err, rows, fields) => {
        if (err) res.send('Error 404: Error while deleting')
        else {
            res.status(200).render('search', {
                temp: table,
                columns: rows,
                attribute: '',
                message: '',
                attrs: '',
                someData: ''
            })
        }
    })
})

app.post('/search/table', (req, res) => {

    //TODO: Checking for incompatible data
    const table = req.query.name
    const qAttr = req.query.attr
    const {value, attr} = req.body
    // console.log('req.query :',req.query)
    // console.log('req.body :',req.body)

    if (qAttr === '') {
        connection.query('desc ' + table, (err, rows, fields) => {
            res.status(200).render('search', {
                temp: table,
                columns: rows,
                attribute: attr,
                message: '',
                attrs: '',
                someData: ''
            })
        })
    } else {
        let query = 'select * from ' + table + ' where ' + qAttr + ' = \'' + value + '\''

        connection.query(query, (err, rows, fields) => {
            if (err) res.send('Some error')
            else if (isEmpty(rows)) {
                res.status(200).render('search', {
                    temp: '',
                    columns: '',
                    attribute: '',
                    message: 'Nothing found',
                    attrs: '',
                    someData: '',
                    name: table,
                    searchAttribute: qAttr,
                    searchValue: value
                })
            } else {
                res.status(200).render('search', {
                    temp: '',
                    columns: '',
                    attribute: '',
                    message: 'Result of search',
                    attrs: fields,
                    someData: rows,
                    name: table,
                    searchAttribute: qAttr,
                    searchValue: value
                })
            }
        })
    }
})

app.post('/search/sort', (req, res) => {
    const {table, attr, value} = req.query
    // console.log(req.query)
    connection.query('select * from ' + table + ' where ' + attr + ' = \'' + value + '\'' + ' order by ' + req.body.sortBy + ' ' + req.body.sortByOrder, (err, rows, fields) => {
        if (err) throw err
        res.status(200).render('search', {
            temp: '',
            columns: '',
            attribute: '',
            message: 'Result of search',
            attrs: fields,
            someData: rows,
            name: table,
            searchAttribute: attr,
            searchValue: value,
            highlightNo: -1
        })
    })
})

app.get('/see', (req, res) => {

    res.status(200).render('see', {
        name: '',
        someData: '',
        columns: ''
    })
})

app.get('/see/query', (req, res) => {
    const table = req.query.tablelist

    connection.query('select * from ' + table, (err, rows, fields) => {
        if (err) throw err
        res.status(200).render('see', {
            name: table.toString().toLocaleUpperCase(),
            someData: rows,
            columns: fields,
            highlightNo: -1
        })
    })
})

app.post('/see/sort', (req, res) => {
    const table = req.query.table

    connection.query('select * from ' + table + ' order by ' + req.body.sortBy + ' ' + req.body.sortByOrder, (err, rows, fields) => {
        if (err) throw err
        res.status(200).render('see', {
            name: table.toString().toLocaleUpperCase(),
            someData: rows,
            columns: fields,
            highlightNo: -1
        })
    })
})

app.get('/advance', (req, res) => {
    res.status(200).render('advance', {
        message: '',
        columns: '',
        someData: ''
    })
})

app.get('/advance/sql', (req, res) => {
    const query = req.query.sqlQuery
    let operations = {update: 'update', delete: 'delete', insert: 'insert'}

    connection.query(query, (err, rows, fields) => {
        if (err) {
            res.status(200).render('advance', {
                message: 'Error :>' + err.message,
                columns: '',
                someData: ''
            })
        } else if (query.toString().split(' ')[0].toLowerCase() in operations) {
            console.log('HIi')
            res.status(200).render('advance', {
                message: 'Query \'' + query + '\' successful',
                columns: '',
                someData: ''
            })
        } else {
            res.status(200).render('advance', {
                message: 'Result of \'' + query + '\':',
                columns: fields,
                someData: rows
            })
        }
    })
})

app.get('/about', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, './public/about.html'))
})

app.get('/team', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, './public/teams.html'))
})

app.listen(4000, () => {
    console.log('App running on port 4000')
})
