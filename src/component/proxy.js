const obj = new Proxy(data,{
    get(target,key){
        track(target, key)
        return target[key]
    }
})