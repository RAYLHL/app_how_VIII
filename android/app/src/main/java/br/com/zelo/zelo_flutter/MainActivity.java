package br.com.zelo.zelo_flutter;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.net.Uri;
import android.os.SystemClock;
import java.io.*;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

/** Small Android bridge; interface, map and business rules live in Dart. */
public class MainActivity extends FlutterActivity {
  private CurrentLocation gps;
  private MethodChannel.Result locationResult,photoResult;
  private boolean waitingPermission;
  private final ExecutorService io=Executors.newSingleThreadExecutor();
  @Override public void configureFlutterEngine(FlutterEngine engine) {
    super.configureFlutterEngine(engine);gps=new CurrentLocation(this);
    new MethodChannel(engine.getDartExecutor().getBinaryMessenger(),"br.com.zelo/native")
      .setMethodCallHandler((call,result)->{
        switch(call.method) {
          case "load": io.execute(()->{String raw=getSharedPreferences("zelo_flutter_v1",MODE_PRIVATE).getString("reports",null);
            runOnUiThread(()->result.success(raw));});break;
          case "save":
            String raw=(String)call.arguments;
            io.execute(()->{boolean ok=getSharedPreferences("zelo_flutter_v1",MODE_PRIVATE).edit().putString("reports",raw).commit();
              runOnUiThread(()->{if(ok)result.success(null);else result.error("storage","Não foi possível gravar os dados.",null);});});break;
          case "location":
            if(locationResult!=null){result.error("busy","Uma localização já está em andamento.",null);break;}
            locationResult=result;
            if(!gps.permitted()) {waitingPermission=true;requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},45);}
            else startLocation();break;
          case "photo":
            if(photoResult!=null){result.error("busy","O seletor de foto já está aberto.",null);break;}
            photoResult=result;
            try {Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
              startActivityForResult(pick,46);
            }catch(Exception e){photoResult=null;result.error("photo","Não foi possível abrir o seletor de imagens.",null);}break;
          default:result.notImplemented();
        }
      });
  }
  private void startLocation() {
    waitingPermission=false;
    gps.request(new CurrentLocation.Callback(){
      @Override public void success(Location l){
        MethodChannel.Result pending=locationResult;locationResult=null;if(pending==null)return;
        if(l.getAccuracy()>100){pending.error("accuracy","Localização com precisão pior que 100 m. Escolha o ponto no mapa.",null);return;}
        Map<String,Object> data=new HashMap<>();data.put("lat",l.getLatitude());data.put("lon",l.getLongitude());
        data.put("accuracy",(double)l.getAccuracy());
        long age=Math.max(0,(SystemClock.elapsedRealtimeNanos()-l.getElapsedRealtimeNanos())/1000000);
        data.put("time",System.currentTimeMillis()-age);pending.success(data);
      }
      @Override public void failure(String message){failLocation(message);}
    });
  }
  private void failLocation(String text){if(gps!=null)gps.cancel();MethodChannel.Result result=locationResult;locationResult=null;
    if(result!=null)result.error("location",text,null);}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] granted){
    super.onRequestPermissionsResult(request,permissions,granted);
    if(request==45){waitingPermission=false;if(gps.permitted())startLocation();else failLocation("Permissão negada. Escolha um ponto manualmente no mapa.");}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request!=46||photoResult==null)return;
    MethodChannel.Result pending=photoResult;photoResult=null;
    if(result!=RESULT_OK||data==null||data.getData()==null){pending.success(null);return;}
    Uri uri=data.getData();
    io.execute(()->{
      File target=null;
      try {
        File directory=new File(getFilesDir(),"photos");if(!directory.exists()&&!directory.mkdirs())throw new IOException("Pasta indisponível");
        target=new File(directory,UUID.randomUUID()+".image");
        try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(target)){
          if(in==null)throw new IOException("Foto indisponível");
          byte[] buffer=new byte[8192];int n;long total=0;
          while((n=in.read(buffer))!=-1){total+=n;if(total>20*1024*1024)throw new IOException("Escolha uma imagem de até 20 MB.");out.write(buffer,0,n);}
        }
        String path=target.getAbsolutePath();runOnUiThread(()->pending.success(path));
      }catch(Exception e){if(target!=null)target.delete();String message=e.getMessage();runOnUiThread(()->pending.error("photo",message,null));}
    });
  }
  @Override protected void onStop(){super.onStop();if(locationResult!=null&&!waitingPermission)failLocation("Localização cancelada ao sair do aplicativo.");}
  @Override protected void onDestroy(){if(gps!=null)gps.cancel();locationResult=null;photoResult=null;io.shutdown();super.onDestroy();}
}
