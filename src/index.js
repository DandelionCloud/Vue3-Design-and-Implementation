document.body.innerText = ' Hello!'
console.log('同步任务')

setTimeout(() => {
    document.body.innerText = 'After Hello!'
    console.log('宏任务')
}, 0)