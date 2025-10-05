(function(){
  function $(s, c){ return (c||document).querySelector(s); }
  function $$(s, c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); }
  var secure = (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  var gpsPill = $('#gpsPill'), compassPill = $('#compassPill'), popsPill = $('#popsPill');

  // HTTPS banner
  var banner = $('#insecureBanner');
  if(!secure){ banner.classList.add('show'); banner.innerHTML = '⚠️ لازم HTTPS أو localhost لتحديد الموقع/البوصلة.'; }

  // Date default
  var d = $('#reportDate');
  if(d && !d.value){
    var now=new Date();
    d.value = [now.getFullYear(), ('0'+(now.getMonth()+1)).slice(-2), ('0'+now.getDate()).slice(-2)].join('-');
  }

  // Load POPS
  var POPS=null;
  function loadPOPS(){
    var xhr=new XMLHttpRequest();
    xhr.open('GET','./pops.json',true);
    xhr.onreadystatechange=function(){
      if(xhr.readyState===4){
        if(xhr.status>=200 && xhr.status<300){
          try{ POPS=JSON.parse(xhr.responseText); popsPill.className='pill ok'; popsPill.textContent='POPs: '+POPS.length; }
          catch(e){ popsPill.className='pill warn'; popsPill.textContent='POPs: خطأ JSON'; }
        }else{
          popsPill.className='pill warn'; popsPill.textContent='POPs: فشل التحميل';
        }
      }
    };
    xhr.send();
  }
  loadPOPS();

  // Utils
  function toRad(d){ return d*Math.PI/180; }
  function toDeg(r){ return r*180/Math.PI; }
  function distanceKm(lat1, lon1, lat2, lon2){
    var R=6371, dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
    var a=Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function bearingDeg(lat1, lon1, lat2, lon2){
    var y=Math.sin(toRad(lon2-lon1))*Math.cos(toRad(lat2));
    var x=Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
    return (toDeg(Math.atan2(y,x))+360)%360;
  }
  function parseLatLonFlexible(input){
    if(!input) return null;
    var s=input.replace(/\u060C/g, ',').replace(/;/g, ',').replace(/\s+/g,' ').replace(' ,', ',').replace(', ', ',');
    var parts = s.indexOf(',')>=0 ? s.split(',') : s.split(' ');
    if(parts.length!==2) return null;
    var a=parseFloat(parts[0]), b=parseFloat(parts[1]);
    if(isNaN(a)||isNaN(b)) return null;
    var lat, lon;
    if(Math.abs(a)<=90 && Math.abs(b)<=180){ lat=a; lon=b; }
    else if(Math.abs(b)<=90 && Math.abs(a)<=180){ lat=b; lon=a; }
    else return null;
    return {lat:lat, lon:lon};
  }
  function formatDistance(km){ return km<1 ? (Math.round(km*1000)+' م') : (km.toFixed(2)+' كم'); }

  // Compass (optional)
  var COMPASS_ON=false, DEVICE_HEADING=null, arrowNodes=[];
  function extractHeading(e){
    if(typeof e.webkitCompassHeading==='number') return e.webkitCompassHeading;
    if(typeof e.alpha==='number') return (360 - e.alpha) % 360;
    return null;
  }
  function updateArrowsRotation(){
    if(DEVICE_HEADING==null) return;
    for(var i=0;i<arrowNodes.length;i++){
      var node=arrowNodes[i], absB=parseFloat(node.getAttribute('data-absbearing')||'0');
      var rel=(absB - DEVICE_HEADING + 360)%360;
      node.style.transform='rotate('+Math.round(rel)+'deg)';
    }
  }
  function enableCompass(){
    if(!secure){ alert('البوصلة تحتاج HTTPS أو localhost'); return; }
    compassPill.className='pill warn'; compassPill.textContent='Compass: طلب إذن...';
    try{
      if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission==='function'){
        DeviceOrientationEvent.requestPermission().then(function(perm){
          if(perm!=='granted'){ compassPill.className='pill warn'; compassPill.textContent='Compass: مرفوض'; return; }
          window.addEventListener('deviceorientation', function(e){
            DEVICE_HEADING = extractHeading(e);
            if(DEVICE_HEADING==null){ compassPill.className='pill warn'; compassPill.textContent='Compass: غير متاح'; }
            else { compassPill.className='pill ok'; compassPill.textContent='Compass: '+Math.round(DEVICE_HEADING)+'°'; if(COMPASS_ON) updateArrowsRotation(); }
          }, true);
          COMPASS_ON=true;
        }).catch(function(err){ alert('تعذر تفعيل البوصلة: '+err.message); compassPill.className='pill warn'; compassPill.textContent='Compass: خطأ'; });
      }else{
        window.addEventListener('deviceorientation', function(e){
          DEVICE_HEADING = extractHeading(e);
          if(DEVICE_HEADING==null){ compassPill.className='pill warn'; compassPill.textContent='Compass: غير متاح'; }
          else { compassPill.className='pill ok'; compassPill.textContent='Compass: '+Math.round(DEVICE_HEADING)+'°'; if(COMPASS_ON) updateArrowsRotation(); }
        }, true);
        COMPASS_ON=true;
      }
    }catch(e){ alert('تعذر تفعيل البوصلة: '+e.message); }
  }

  // Tracking
  var watchId=null;
  function startTracking(){
    if(!secure){ alert('التتبّع يحتاج HTTPS أو localhost'); return; }
    if(!('geolocation' in navigator)){ alert('المتصفح لا يدعم تتبع الموقع'); return; }
    if(watchId!==null) return;
    watchId = navigator.geolocation.watchPosition(function(pos){
      var lat=pos.coords.latitude.toFixed(6), lon=pos.coords.longitude.toFixed(6);
      $('#location').value = lat+', '+lon;
      gpsPill.className='pill ok'; gpsPill.textContent='GPS: نشط (±'+Math.round(pos.coords.accuracy)+'م)';
      $('#trackInfo').textContent = 'آخر تحديث: ' + new Date(pos.timestamp).toLocaleTimeString();
      computeNearest();
    }, function(err){
      gpsPill.className='pill warn'; gpsPill.textContent='GPS: خطأ';
      alert('تتبّع GPS فشل: ' + err.message);
    }, {enableHighAccuracy:true, timeout:20000, maximumAge:2000});
    $('#trackBtn').textContent='⏹️ إيقاف التتبع';
  }
  function stopTracking(){
    if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; $('#trackInfo').textContent=''; $('#trackBtn').textContent='▶️ تشغيل التتبع'; gpsPill.className='pill muted'; gpsPill.textContent='GPS: غير مفعل'; }
  }

  // Nearest
  function renderNearest(lat, lon, ranked){
    var out=$('#nearestResult'); out.innerHTML=''; arrowNodes.length=0;
    for(var i=0;i<ranked.length;i++){
      var p=ranked[i];
      var item=document.createElement('div'); item.className='pop-item';
      var left=document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='10px';
      var arrow=document.createElementNS('http://www.w3.org/2000/svg','svg'); arrow.setAttribute('viewBox','0 0 24 24'); arrow.setAttribute('class','arrow'); arrow.setAttribute('data-absbearing', String(p.brng));
      if(DEVICE_HEADING==null){ arrow.style.transform='rotate('+Math.round(p.brng)+'deg)'; }
      arrow.innerHTML='<circle cx="12" cy="12" r="10" fill="#e2f7f4" stroke="#065f46" stroke-width="1.5"/><path d="M12 4l4 6h-3v8h-2V10H8l4-6z" fill="#065f46" />';
      var info=document.createElement('div');
      var title=document.createElement('div'); title.style.fontWeight='700'; title.appendChild(document.createTextNode('#'+(i+1)+' '+p.name));
      var meta=document.createElement('div'); meta.setAttribute('class','pop-meta'); meta.appendChild(document.createTextNode('المسافة: '+formatDistance(p.dist)+' • الاتجاه: '+Math.round(p.brng)+'°'));
      info.appendChild(title); info.appendChild(meta);
      left.appendChild(arrow); left.appendChild(info);
      var right=document.createElement('div');
      var btn=document.createElement('button'); btn.className='btn btn-sm text-white'; btn.style.background='#0a6'; btn.appendChild(document.createTextNode('➡️ مسار'));
      (function(p){ btn.onclick=function(){ window.open('https://www.google.com/maps/dir/?api=1&origin='+lat+','+lon+'&destination='+p.lat+','+p.lon,'_blank'); }; })(p);
      right.appendChild(btn);
      item.appendChild(left); item.appendChild(right); out.appendChild(item);
      arrowNodes.push(arrow);
    }
    if(COMPASS_ON && DEVICE_HEADING!=null) updateArrowsRotation();
    $('#statusBar').textContent = ranked.length ? ('تم إيجاد '+ranked.length+' أقرب بوبات.') : 'لم يتم العثور على بوبات قريبة.';
  }
  function computeNearest(){
    var parsed = parseLatLonFlexible(($('#location')||{}).value||'');
    if(!parsed || !POPS) return;
    var lat=parsed.lat, lon=parsed.lon;
    var arr=[], i;
    for(i=0;i<POPS.length;i++){
      var p=POPS[i], dist=distanceKm(lat,lon,p.lat,p.lon), br= bearingDeg(lat,lon,p.lat,p.lon);
      arr.push({name:p.name, lat:p.lat, lon:p.lon, dist:dist, brng:br});
    }
    arr.sort(function(a,b){ return a.dist-b.dist; });
    var dedup=[], j;
    for(i=0;i<arr.length;i++){
      var cand=arr[i], unique=true;
      for(j=0;j<dedup.length;j++){ if(distanceKm(cand.lat,cand.lon,dedup[j].lat,dedup[j].lon) <= 0.05){ unique=false; break; } }
      if(unique){ dedup.push(cand); if(dedup.length===3) break; }
    }
    renderNearest(lat, lon, dedup);
    var popField = $('#popField'); if(popField && !popField.value && dedup[0]) popField.value = dedup[0].name;
  }

  // Bind buttons
  $('#pickLoc').addEventListener('click', function(){
    if(!secure){ alert('التقاط تلقائي يحتاج HTTPS أو localhost'); return; }
    if(!('geolocation' in navigator)){ alert('المتصفح لا يدعم تحديد الموقع'); return; }
    var btn=this, prev=btn.textContent; btn.disabled=true; btn.textContent='جاري الالتقاط...';
    navigator.geolocation.getCurrentPosition(function(p){
      $('#location').value = p.coords.latitude.toFixed(6)+', '+p.coords.longitude.toFixed(6);
      gpsPill.className='pill ok'; gpsPill.textContent='GPS: مرة واحدة (±'+Math.round(p.coords.accuracy)+'م)';
      btn.textContent='تم ✓'; btn.disabled=false; computeNearest();
    }, function(e){ alert('تعذر تحديد الموقع: '+e.message); btn.textContent=prev; btn.disabled=false; }, {enableHighAccuracy:true, timeout:15000, maximumAge:0});
  });
  $('#trackBtn').addEventListener('click', function(){ if(watchId===null) startTracking(); else stopTracking(); });
  $('#openMapBtn').addEventListener('click', function(){ var parsed=parseLatLonFlexible(($('#location')||{}).value||''); if(!parsed){ alert('أدخل الإحداثيات مثل 33.269143, 44.298727'); return; } window.open('https://www.google.com/maps?q='+parsed.lat+','+parsed.lon,'_blank'); });
  $('#nearestBtn').addEventListener('click', computeNearest);
  $('#compassBtn').addEventListener('click', enableCompass);
  $('#location').addEventListener('input', function(){ setTimeout(computeNearest, 300); });

  // Add row
  $('#addCustomRow').addEventListener('click', function(){
    var tr=document.createElement('tr');
    tr.innerHTML='<td><input type="text" class="form-control" placeholder="اسم المادة/الجهاز"></td>'
      +'<td><input type="text" class="form-control extra-det" placeholder="التفاصيل"></td>'
      +'<td><input type="number" min="0" class="form-control extra-qty" placeholder="0"></td>'
      +'<td><input type="text" class="form-control extra-note" placeholder="ملاحظات"></td>'
      +'<td><button type="button" class="btn btn-sm btn-outline-danger del-row">حذف</button></td>';
    $('#extrasBody').appendChild(tr);
  });
  $('#extrasBody').addEventListener('click', function(e){ if(e.target && e.target.classList.contains('del-row')){ var tr=e.target.closest('tr'); if(tr) tr.remove(); } });

  // PDF / Share
  function ensurePDF(){ return !!(window.jspdf && window.jspdf.jsPDF); }
  function imagesFromInputsList(ids, done){
    var list=[], pending=0;
    function addFile(f,label){ var fr=new FileReader(); pending++; fr.onload=function(){ list.push({label:label, dataUrl:fr.result}); pending--; if(pending===0) done(list); }; fr.readAsDataURL(f); }
    for(var i=0;i<ids.length;i++){
      var inp=document.getElementById(ids[i][0]); var label=ids[i][1];
      if(!inp || !inp.files) continue;
      for(var k=0;k<inp.files.length;k++){ addFile(inp.files[k], label); }
    }
    if(pending===0) done(list);
  }
  function addImagePage(doc, du, caption, cb){
    var img=new Image();
    img.onload=function(){
      var pageW=doc.internal.pageSize.getWidth(), pageH=doc.internal.pageSize.getHeight();
      var iw=img.naturalWidth, ih=img.naturalHeight, r=Math.min((pageW-20)/iw,(pageH-40)/ih), w=iw*r, h=ih*r;
      doc.addPage(); doc.addImage(du,'JPEG',(pageW-w)/2,10,w,h,undefined,'FAST'); if(caption){ doc.text(caption, 10, pageH-10); } cb();
    };
    img.onerror=function(){ doc.addPage(); cb(); };
    img.src=du;
  }
  function exportOrShare(action){
    if(!ensurePDF()){ alert('مكتبة PDF غير متاحة (قد يمنعها CSP).'); return; }
    var need=function(sel){ var el=document.querySelector(sel); return !!(el && el.value && el.value.trim()); };
    var needF=function(sel){ var el=document.querySelector(sel); return !!(el && el.files && el.files.length>0); };
    var errs=[];
    if(!need('#customerName')) errs.push('اسم الكوستمر'); if(!need('#location')) errs.push('الموقع'); if(!need('#bandField')) errs.push('الباند'); if(!need('#techName')) errs.push('اسم الفني'); if(!need('#engName')) errs.push('المتابعة مع');
    if(!needF('#img_pop')) errs.push('صورة باتجاه البوب'); if(!needF('#img_tower')) errs.push('صورة مكان التور/البول'); if(!needF('#img_rack')) errs.push('صورة مكان نصب الراك/الراوتر'); if(!needF('#img_cables')) errs.push('صور أماكن تسليك الكيبلات');
    if(errs.length){ alert('يرجى إكمال الحقول:\n• '+errs.join('\n• ')); return; }
    var jsPDF=window.jspdf.jsPDF, doc=new jsPDF({unit:'mm',format:'a4',compress:true});
    doc.text('Site Survey', 190, 10, {align:'right'});
    var rows=$$('#extrasBody tr'), y=20;
    for(var i=0;i<rows.length;i++){
      var cells=rows[i].querySelectorAll('td');
      var name=(cells[0].querySelector('input')?cells[0].querySelector('input').value:'') || 'مادة';
      var det=cells[1].querySelector('input')?cells[1].querySelector('input').value:'';
      var qty=cells[2].querySelector('input')?cells[2].querySelector('input').value:'';
      var note=cells[3].querySelector('input')?cells[3].querySelector('input').value:'';
      var line='• '+name+(det?(' | '+det):'')+(qty?(' | العدد: '+qty):'')+(note?(' | ملاحظات: '+note):'');
      doc.text(line,10,y); y+=7; if(y>280){ doc.addPage(); y=20; }
    }
    imagesFromInputsList([['img_pop','صورة باتجاه البوب'],['img_tower','صورة مكان التور/البول'],['img_rack','صورة مكان نصب الراك/الراوتر'],['img_cables','صور أماكن تسليك الكيبلات'],['img_other','صور أخرى']], function(list){
      (function addNext(i){
        if(i>=list.length){
          var name=(($('#customerName')||{}).value||'Site_Survey').replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
          if(action==='save'){ doc.save(name); }
          else{
            var blob=doc.output('blob');
            try{
              if(navigator.canShare && navigator.canShare({ files: [new File([blob], name, {type:'application/pdf'})] })){
                navigator.share({ files:[new File([blob], name, {type:'application/pdf'})], title:name, text:'تقرير موقع' });
              }else{
                var url=URL.createObjectURL(blob); window.open(url,'_blank'); setTimeout(function(){URL.revokeObjectURL(url);},4000);
              }
            }catch(e){ alert('تعذر المشاركة: '+e.message); }
          }
          return;
        }
        addImagePage(doc, list[i].dataUrl, list[i].label, function(){ addNext(i+1); });
      })(0);
    });
  }
  $('#exportBtn').addEventListener('click', function(){ exportOrShare('save'); });
  $('#shareBtn').addEventListener('click', function(){ exportOrShare('share'); });
})();