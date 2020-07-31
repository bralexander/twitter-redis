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

  // app.get('/', (req, res) => {
  //   if (req.session.userid) {
  //     client.hkeys('users', (err, users) => {
  //       console.log(users)
  //       res.render('dashboard', {
  //         users
  //       })
  //     })
  //   } else {
  //     res.render('login')
  //   }
  // })

  app.get('/', (req, res) => {
    if (req.session.userid) {
      client.hget(`user:${req.session.userid}`, 'username', (err, currentUserName) => {
        client.smembers(`following:${currentUserName}`, (err, following) => {
          client.hkeys('users', (err, users) => {
            res.render('dashboard', {
              users: users.filter((user) => user !== currentUserName && following.indexOf(user) === -1)
            })
          })
        })
      })
    } else {
      res.render('login')
    }
  })

app.get('/post', (req, res) => {
    if (req.session.userid) {
        res.render('post')
    } else {
        res.render('login')
    }
})

app.post('/follow', (req, res) => {
  if (!req.session.userid) {
    res.render('login')
    return
  }

  const { username } = req.body
  
  client.hget(`user:${req.session.userid}`, 'username', (err, currentUserName) => {
    client.sadd(`following:${currentUserName}`, username)
    client.sadd(`followers:${username}`, currentUserName)
  })

  res.redirect('/')
})

app.post('/post', (req, res) => {
  if (!req.session.userid) {
    res.render('login')
    return
  }
  
  const { message } = req.body
  
  client.incr('postid', async (err, postid) => {
    client.hmset(`post:${postid}`, 'userid', req.session.userid, 'message', message, 'timestamp', Date.now())
    res.render('dashboard')
  })
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
      client.hkeys('users', (err, users) => {
        res.render('dashboard', {
          users
        })
      })
    }

      const handleSignup = (username, password) => {
          client.incr('userid', async (err, userid) => {
              client.hset('users', username, userid)
              const saltRounds =10
              const hash = await bcrypt.hash(password, saltRounds)
              client.hset(`user:${userid}`, 'hash', hash, 'username', username)
              saveSessionAndRenderDashboard(userid)
          })
      }
      const handleLogin = (userid, password) => {
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

    client.hget('users', username, (err, userid) => {
        if (!userid) {
          //user does not exist, signup procedure
          handleSignup(username, password)
        } else {
            handleLogin(userid, password)
            }
        })
      
    })
app.listen(3000, () => console.log('Server ready'))
    

    