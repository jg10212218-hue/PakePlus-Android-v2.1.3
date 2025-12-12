window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});// very important, if you don't know what it is, don't touch it
// 非常重要，不懂代码不要动，这里可以解决80%的问题，也可以生产1000+的bug
/**
 * @description 针对 equipmentManagement 路由的 URL 规范化
 * 如果命中 /#/equipmentManagement，则强制改写前缀为
 * https://service.emposat.com/child/station-control/index.html#/
 */
const normalizeEquipmentUrl = (rawUrl) => {
    // 防御性检查：确保 rawUrl 是有效的字符串
    if (!rawUrl || typeof rawUrl !== 'string') {
        console.warn('[normalizeEquipmentUrl] 无效的 URL:', rawUrl)
        return rawUrl || ''
    }
    
    try {
        const u = new URL(rawUrl, window.location.href)
        const hash = u.hash || ''
        if (hash.startsWith('#/equipmentManagement')) {
            const normalized = 'https://service.emposat.com/child/station-control/index.html' + hash
            console.log('[normalizeEquipmentUrl] 改写 URL:', rawUrl, '→', normalized)
            return normalized
        }
        return u.toString()
    } catch (e) {
        // URL 解析失败，返回原始字符串
        console.warn('[normalizeEquipmentUrl] URL 解析失败:', e)
        return rawUrl
    }
}

/**
 * @description 安全跳转函数，针对 WebView 和微前端 iframe 优化
 * @param {string} url 目标 URL
 * @param {Window} targetWindow 目标 window 对象
 * @returns {void}
 */
function safeNavigate(url, targetWindow) {
    if (!url || typeof url !== 'string') {
        console.warn('[safeNavigate] 无效的 URL:', url)
        return
    }
    
    // 🔥 关键：先进行 URL 规范化
    const normalizedUrl = normalizeEquipmentUrl(url)
    
    // 使用顶层 window（跳出 iframe）
    const win = targetWindow || window.top || window.parent || window
    const isTopWindow = win === window
    
    console.log('[safeNavigate] 准备跳转:', normalizedUrl)
    console.log('[safeNavigate] 使用 window:', isTopWindow ? '当前窗口' : '顶层窗口（已跳出 iframe）')
    
    // 使用异步方式确保在 WebView 中执行
    setTimeout(() => {
        console.log('[safeNavigate] 开始执行跳转')
        
        // 策略1: 使用 location.replace（推荐，不保留历史）
        try {
            win.location.replace(normalizedUrl)
            console.log('[safeNavigate] ✓ 使用 location.replace 跳转成功')
            return
        } catch (e) {
            console.warn('[safeNavigate] ✗ location.replace 失败:', e)
        }
        
        // 策略2: 使用 location.assign
        try {
            win.location.assign(normalizedUrl)
            console.log('[safeNavigate] ✓ 使用 location.assign 跳转成功')
            return
        } catch (e) {
            console.warn('[safeNavigate] ✗ location.assign 失败:', e)
        }
        
        // 策略3: 直接设置 location.href
        try {
            win.location.href = normalizedUrl
            console.log('[safeNavigate] ✓ 使用 location.href 跳转成功')
            return
        } catch (e) {
            console.warn('[safeNavigate] ✗ location.href 失败:', e)
        }
        
        // 策略4: 创建 <a> 标签并模拟点击
        try {
            const targetDoc = win.document || document
            const anchor = targetDoc.createElement('a')
            anchor.href = normalizedUrl
            anchor.style.display = 'none'
            targetDoc.body.appendChild(anchor)
            anchor.click()
            
            setTimeout(() => {
                try {
                    targetDoc.body.removeChild(anchor)
                } catch (e) {}
            }, 100)
            
            console.log('[safeNavigate] ✓ 使用模拟点击跳转')
        } catch (e) {
            console.error('[safeNavigate] ✗ 所有跳转策略均失败:', e)
        }
    }, 10)
}

/**
 * @description 为指定 window 对象重写 window.open 并注册点击事件
 * @param {Window} targetWindow 要重写的 window 对象
 * @param {Document} targetDocument 目标 document 对象
 * @param {string} label 日志标签
 * @returns {boolean} 是否重写成功
 */
function overrideWindowOpen(targetWindow, targetDocument, label) {
    // 检查参数有效性
    if (!targetWindow || !targetDocument) {
        console.warn(`[overrideWindowOpen] targetWindow 或 targetDocument 为空，跳过`)
        return false
    }
    
    // 防止重复重写
    if (targetWindow.__vcOpenOverridden) {
        console.log(`[overrideWindowOpen] ${label} 已重写，跳过`)
        return false
    }
    
    try {
        // 标记已重写
        targetWindow.__vcOpenOverridden = true
        
        // 1. 重写 window.open
        targetWindow.open = function (url, target, features) {
            console.log(`[window.open ${label}] 被调用 ===>`, url)
            
            if (!url) {
                console.warn(`[window.open ${label}] URL 为空`)
                return null
            }
            
            // 🔥 关键：跳转前先进行 URL 规范化
            const normalizedUrl = normalizeEquipmentUrl(String(url))
            
            // 跳转到顶层窗口
            safeNavigate(normalizedUrl, targetWindow.top || targetWindow.parent || targetWindow)
            return null
        }
        
        console.log(`[overrideWindowOpen] ✓ 已重写 ${label} 的 window.open`)
        
        // 2. 为 iframe 内部注册点击事件监听（关键！）
        if (label !== 'main') {
            targetDocument.addEventListener('click', (e) => {
                const origin = e.target.closest('a')
                const isBaseTargetBlank = targetDocument.querySelector('head base[target="_blank"]')
                
                console.log(`[hookClick ${label}] origin:`, origin, 'isBaseTargetBlank:', isBaseTargetBlank)
                
                if (
                    (origin && origin.href && origin.target === '_blank') ||
                    (origin && origin.href && isBaseTargetBlank)
                ) {
                    e.preventDefault()
                    e.stopPropagation() // 阻止事件冒泡
                    console.log(`[hookClick ${label}] 拦截 iframe 内链接点击:`, origin.href)
                    
                    // 🔥 关键：跳转前先进行 URL 规范化
                    const normalizedUrl = normalizeEquipmentUrl(origin.href)
                    safeNavigate(normalizedUrl, targetWindow.top || targetWindow.parent || targetWindow)
                }
            }, { capture: true })
            
            console.log(`[overrideWindowOpen] ✓ 已为 ${label} 注册点击事件`)
        }
        
        return true
    } catch (e) {
        console.error(`[overrideWindowOpen] ✗ 重写 ${label} 失败:`, e)
        return false
    }
}

/**
 * @description 监听并处理所有 iframe（微前端架构核心）
 * @returns {object} 返回控制对象，包含 stop 方法用于清理资源
 */
function hookAllIframes() {
    console.log('[hookAllIframes] 开始监听 iframe')
    
    // 使用 WeakMap 追踪已处理的 iframe，避免重复处理
    const processedIframes = new WeakMap()
    let iframeCounter = 0
    
    // 处理已存在的 iframe
    function processIframes() {
        const iframes = document.querySelectorAll('iframe')
        console.log('[hookAllIframes] 扫描到', iframes.length, '个 iframe')
        
        iframes.forEach((iframe) => {
            try {
                // 检查是否可以访问 contentWindow（排除跨域 iframe）
                if (!iframe.contentWindow) {
                    return
                }
                
                // 尝试访问 contentDocument 来检测跨域
                const canAccess = (() => {
                    try {
                        // 访问 contentDocument 会在跨域时抛出异常
                        return !!iframe.contentDocument
                    } catch (e) {
                        return false
                    }
                })()
                
                if (!canAccess) {
                    // 跨域 iframe 只记录一次
                    if (!processedIframes.has(iframe)) {
                        console.warn(`[hookAllIframes] iframe 跨域，无法注入`)
                        processedIframes.set(iframe, 'cross-origin')
                    }
                    return
                }
                
                // 检查是否已注册过（用于分配唯一 ID）
                const alreadyRegistered = processedIframes.has(iframe)
                
                // 为新 iframe 分配 ID
                let iframeId
                if (alreadyRegistered) {
                    iframeId = processedIframes.get(iframe)
                    // 跳过错误状态和跨域状态
                    if (iframeId === 'error' || iframeId === 'cross-origin') {
                        return
                    }
                } else {
                    iframeId = `iframe-${iframeCounter++}`
                }
                
                // 处理 iframe 的函数
                const injectToIframe = () => {
                    if (!iframe.contentWindow || !iframe.contentDocument) {
                        console.warn(`[hookAllIframes] ${iframeId} contentWindow 或 contentDocument 为空`)
                        return false
                    }
                    
                    // 检查是否需要重新注入（iframe 内部可能发生了路由跳转）
                    const needsReinject = !iframe.contentWindow.__vcOpenOverridden
                    
                    if (needsReinject) {
                        console.log(`[hookAllIframes] ${iframeId} 需要${processedIframes.has(iframe) ? '重新' : ''}注入`)
                    }
                    
                    if (overrideWindowOpen(iframe.contentWindow, iframe.contentDocument, iframeId)) {
                        processedIframes.set(iframe, iframeId)
                        console.log(`[hookAllIframes] ✓ ${iframeId} 已完成注入`)
                        return true
                    }
                    return false
                }
                
                // 检查 iframe 是否已加载
                if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    // 已加载完成，立即重写
                    injectToIframe()
                } else {
                    // 未加载完成，等待 load 事件
                    processedIframes.set(iframe, 'loading')
                }
                
                // 监听 iframe 的 load 事件（每次 iframe 导航都会触发）
                // 注意：不使用 { once: true }，因为需要监听 iframe 内部的每次路由跳转
                iframe.addEventListener('load', () => {
                    console.log(`[hookAllIframes] ${iframeId} load 事件触发`)
                    
                    // 延迟注入，确保 iframe 内容完全加载
                    setTimeout(() => {
                        try {
                            // 每次 load 都尝试重新注入（处理 iframe 内部路由跳转）
                            // 如果已重写过，overrideWindowOpen 会自动跳过
                            injectToIframe()
                        } catch (e) {
                            console.warn(`[hookAllIframes] ${iframeId} 注入失败:`, e.message)
                        }
                    }, 50)
                })
            } catch (e) {
                // 捕获跨域等异常
                console.warn(`[hookAllIframes] 处理 iframe 失败:`, e.message)
                processedIframes.set(iframe, 'error')
            }
        })
    }
    
    // 立即处理现有 iframe
    processIframes()
    
    // 使用 MutationObserver 监听新增 iframe
    const observer = new MutationObserver((mutations) => {
        let hasNewIframe = false
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'IFRAME') {
                    hasNewIframe = true
                } else if (node.querySelectorAll) {
                    const iframes = node.querySelectorAll('iframe')
                    if (iframes.length > 0) {
                        hasNewIframe = true
                    }
                }
            })
        })
        
        if (hasNewIframe) {
            console.log('[hookAllIframes] 检测到新 iframe，重新扫描')
            processIframes()
        }
    })
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    })
    
    // 定时检查（检测 iframe 内部的路由变化）
    const intervalId = setInterval(() => {
        const iframes = document.querySelectorAll('iframe')
        
        iframes.forEach((iframe) => {
            try {
                // 检查是否可访问且需要重新注入
                if (iframe.contentWindow && iframe.contentDocument) {
                    const needsReinject = !iframe.contentWindow.__vcOpenOverridden
                    
                    if (needsReinject) {
                        console.log('[hookAllIframes] 检测到 iframe 内部路由变化，重新扫描')
                        processIframes()
                        return // 只触发一次重新扫描
                    }
                }
            } catch (e) {
                // 跨域或其他异常，忽略
            }
        })
    }, 2000) // 每 2 秒检查一次
    
    console.log('[hookAllIframes] ✓ 监听器已启动')
    
    // 返回控制对象，用于清理资源
    return {
        stop: () => {
            observer.disconnect()
            clearInterval(intervalId)
            console.log('[hookAllIframes] ✓ 监听器已停止')
        }
    }
}

/**
 * @description 处理主应用的链接点击事件
 * @param {Event} e 点击事件对象
 */
const hookClick = (e) => {
    const origin = e.target.closest('a')
    const isBaseTargetBlank = document.querySelector(
        'head base[target="_blank"]'
    )
    console.log('[hookClick main] origin:', origin, 'isBaseTargetBlank:', isBaseTargetBlank)
    
    if (
        (origin && origin.href && origin.target === '_blank') ||
        (origin && origin.href && isBaseTargetBlank)
    ) {
        e.preventDefault()
        console.log('[hookClick main] 拦截新标签页打开，目标:', origin.href)
        
        // 🔥 关键：跳转前先进行 URL 规范化
        const normalizedUrl = normalizeEquipmentUrl(origin.href)
        safeNavigate(normalizedUrl)
    } else {
        console.log('[hookClick main] 不处理此点击')
    }
}

// ========== 初始化 ==========

// 1. 重写主应用的 window.open
overrideWindowOpen(window, document, 'main')

// 2. 监听点击事件
document.addEventListener('click', hookClick, { capture: true })

// 3. 启动 iframe 监听
let iframeHookController = null

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        iframeHookController = hookAllIframes()
        console.log('[诊断] 页面 URL:', window.location.href)
    })
} else {
    iframeHookController = hookAllIframes()
    console.log('[诊断] 页面 URL:', window.location.href)
}

console.log('[初始化] ✓ 微前端跳转拦截已启动')
console.log('[初始化] ✓ equipmentManagement 路由规范化已启用')

// 可选：提供清理函数（用于调试或卸载）
window.__vcCleanup = () => {
    if (iframeHookController) {
        iframeHookController.stop()
    }
    console.log('[清理] ✓ 已清理所有监听器')
}
