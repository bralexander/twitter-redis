const express = require('express')
const path = require('path')
const redis = require('redis')
const bcrypt =require('bcrypt')
const session = require('express-session')

const app = express()
const client = redis.createClient()

const RedisStore = require('connect-redis')(session)

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))

//middleware
app.use(express.urlencoded({extended: true}))

app.use(
    session({
      store: new RedisStore({ client: client }),
      resave: true,
      saveUninitialized: true,
      cookie: {
        maxAge: 36000000, //10 hours, in milliseconds
        httpOnly: false,
        secure: false,
      },
      secret: 'qwerty123456',
    })
  )

app.get('/', (req, res) => {
    if (req.session.userid) {
        res.render('dashboard')
    } else {
        res.render('login')
    }
})

app.post('/', (req, res) => {
    const { username, password } = req.body
    
    if (!username || !password) {
        res.render('error', {
            message: 'please fill completly'
        }) 
        return
    }

    const saveSessionAndRenderDashboard = userid => {
        req.session.userid = userid
        req.session.save()
        res.render('dashboard')
        }

    client.hget('users', username, (err, userid) => {
        
        if (!userid) {
          //user does not exist, signup procedure
          client.incr('userid', async (err, userid) => {
            client.hset('users', username, userid)
            const saltRounds =10
            const hash = await bcrypt.hash(password, saltRounds)
            client.hset(`user:${userid}`, 'hash', hash, 'username', username)
            saveSessionAndRenderDashboard(userid)
        })
        } else {
            client.hget(`user:${userid}`, 'hash', async (err, hash) => {
                const result = await bcrypt.compare(password, hash)
                if (result) {
                  saveSessionAndRenderDashboard(userid)
                } else {
                  res.render('error', {
                      message: 'Incorrect password',
                  })
                  return
                }
              })
            }
        })
      
    })
app.listen(3000, () => console.log('Server ready'))
    

    