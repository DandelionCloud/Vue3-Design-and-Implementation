/**
 * 问题：分支切换 导致 遗留的副作用函数
 * 解决：每次副作用执行时，先把它从与之关联的依赖集合中删除，当副作用执行完毕后，再重新建立联系
 * 1. 重新设计副作用函数（需要明确知道哪些依赖集合中包含它）
 * 2. track() 中进行依赖集合的收集
 * 3. trigger() 中避免无限循环执行
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect

/**
 * 用于注册副作用函数的 effect 函数
 * 1. deps 中存储所有与该副作用函数关联的依赖集合
 */
function effect(fn) {
    const effectFn = () => {
        // 调用 cleanup 函数完成清除工作
        cleanup(effectFn)
        // 当 effectFn 执行时，将其设置为当前激活的副作用函数
        activeEffect = effectFn
        fn()
    }
    // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
    effectFn.deps = []
    // 执行副作用函数
    effectFn()
}

function cleanup(effectFn) {
    /**
     * -----------------------------------------【递归的思想】------------------------------------------
     * 1. 遍历 effectFn.deps 数组
     * 2. 将 effectFn 从依赖集合中移除
     */
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    /**
     * 重置 effectFn.deps 数组：从设计源头思考（用来干什么的）
     * 1. effectFn.deps 这个数组的每一个元素都是包含若干副作用的 set
     * 2. 一个 key 的依赖集合可以有多个副作用函数，如 Set(3) {f1, f2, f3}，因此将当前副作用函数从依赖集合中删除时，还会有其他副作用存在于依赖集合中
     * 3. 借助 JS 中对象的直接赋值具有的浅拷贝特性，将自己这个副作用函数从 bucket 中移除
     * 结论：effectFn.deps 中只收集与 effectFn 相关联的依赖集合，当从这些依赖集合中把自己移除后，就不再有与 effectFn 相关联的依赖集合了，所以要重置为空数组
     */
    effectFn.deps.length = 0
}

// 存储副作用函数的桶
const bucket = new WeakMap()

// 原始数据
const data = { ok: true, text: 'Hello Vue world-4' }

// 对原始数据的代理
const obj = new Proxy(data, {
    // 拦截读取操作
    get(target, key) {
        track(target, key)
        // 返回属性值
        return target[key]
    },
    // 拦截设置操作
    set(target, key, newVal) {
        // 设置属性值
        target[key] = newVal
        trigger(target, key)
    }
})

// 拦截函数 get 中调用 track() 追踪变化
function track(target, key) {
    if (!activeEffect) return
    let depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, deps = new Set())
    }
    deps.add(activeEffect)
    /**
     * 解释：
     * 1. 在注册副作用函数的 effect 函数中，有一条语句 activeEffect = effectFn，在 JS 中，函数也是对象，对象直接赋值，属于浅拷贝
     * 2. 浅拷贝的两个值，其中一个的修改都会修改另外的值，activeEffect.deps 与 effectFn.deps 的值同步更新 
     * 3. JS 中数组也是对象，数组的直接赋值也是浅拷贝，所以 bucket 中的 deps 与 activeEffect.deps 中的元素同步更新
     * 关系图：
     *  bucket-target-key-deps ----- activeEffect.deps[index]
     *  activeEffect.deps ----- effectFn.deps
     */
    // deps: 一个与当前副作用函数存在联系的依赖集合
    // 将 deps 添加到 activeEffect.deps 数组中
    activeEffect.deps.push(deps)
}

// 设置函数 set 中调用 trigger() 触发变化
function trigger(target, key) {
    const depsMap = bucket.get(target)
    if (!depsMap) { return }
    const effects = depsMap.get(key)
    /**
     * 问题：无限循环执行
     * 1. 副作用执行时，先调用 cleanup 进行清除，即将当前副作用函数从依赖集合中移除
     * 2. 副作用执行时，会进行读取操作，又会被重新收集到依赖集合中，而此时 effects 集合的遍历仍在进行
     * 类似于：
        const set = new Set([1])
        set.forEach(item=>{
            set.delete(1)
            set.add(1)
            console.log('遍历中')
        })
     * ECMAScript 规范解释：在调用 forEach 遍历 Set 集合时，如果一个值已经被访问过了，但该值被删除并重新添加到集合，如果此时 forEach 遍历没有结束，那么该值会被重新访问。
     * 解决：构造另一个 Set 集合并遍历它：
        const set = new Set([1])
        const newSet = new Set(set)
        newSet.forEach(item=>{
            set.delete(1)
            set.add(1)
            console.log('遍历中')
        })
     */
    // effects && effects.forEach(fn => fn())
    const effectsToRun = new Set(effects)
    effectsToRun && effectsToRun.forEach(fn => fn())
}

effect(() => {
    console.log('effect invoke')
    document.body.innerText = obj.ok ? obj.text : 'not'
})

// 遗留副作用的验证
setTimeout(() => {
    console.log('set value')
    obj.text = 'hello effect4'
}, 3000)

setTimeout(() => {
    obj.ok = false
}, 1000)
