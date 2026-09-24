// 浏览器书签栏「快捷添加」脚本生成器
// 产物是拖到书签栏的 javascript: 书签：在任意网页采集 url/标题/描述，
// 弹窗打开本站 /quick-add 预填表单（单行内联，须经 encodeURIComponent 传参）
export function buildQuickAddBookmarklet(origin) {
  const quickAddUrl = `${origin}/quick-add`
  const body = [
    'var url=location.href;',
    'var title=document.title;',
    'var desc=document.getSelection?document.getSelection().toString():"";',
    'if(!desc){var t=document.querySelector("[name=description]");desc=t?t.getAttribute("content")||"":"";}',
    'if(desc.length>500){desc=desc.slice(0,500)+"...";}',
    `void(open('${quickAddUrl}?url='+encodeURIComponent(url)+"&title="+encodeURIComponent(title)+"&desc="+encodeURIComponent(desc),"_blank","toolbar=no,resizable=no,location=no,menubar=no,left=200,top=150,width=420,height=460"));`
  ].join('')
  return 'javascript:' + body
}
