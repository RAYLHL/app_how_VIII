package br.com.zelo.zelo_flutter;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import java.util.concurrent.TimeUnit;

/** Foreground-only, bounded GPS request. A stale position is never used as a new report. */
public final class CurrentLocation implements LocationListener {
  public interface Callback {
    void success(Location location);

    void failure(String message);
  }

  private final Context context;
  private final LocationManager manager;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private Callback callback;
  private Location best;
  private final Runnable timeout = () -> finish();

  public CurrentLocation(Context c) {
    context = c;
    manager = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
  }

  public boolean permitted() {
    return context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
  }

  public void request(Callback cb) {
    cancel();
    callback = cb;
    best = null;
    if (!permitted()) {
      fail("Permita o uso da localização ou escolha um ponto no mapa.");
      return;
    }
    boolean active = false;
    try {
      for (String provider :
          new String[] {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
        if (provider.equals(LocationManager.GPS_PROVIDER)
            && context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) continue;
        if (manager.isProviderEnabled(provider)) {
          Location last = manager.getLastKnownLocation(provider);
          if (fresh(last)) consider(last);
          manager.requestLocationUpdates(provider, 1000, 0, this, Looper.getMainLooper());
          active = true;
        }
      }
    } catch (SecurityException e) {
      fail("A permissão de localização foi removida. Escolha o ponto no mapa.");
      return;
    } catch (IllegalArgumentException ignored) {
    }
    if (!active) {
      fail("Ative a localização do Android ou pressione um ponto no mapa.");
      return;
    }
    if (best != null && best.getAccuracy() <= 25) {
      finish();
      return;
    }
    handler.postDelayed(timeout, 20000);
  }

  public static boolean fresh(Location l) {
    return l != null
        && l.hasAccuracy()
        && SystemClock.elapsedRealtimeNanos() - l.getElapsedRealtimeNanos()
            <= TimeUnit.SECONDS.toNanos(30)
        && SystemClock.elapsedRealtimeNanos() >= l.getElapsedRealtimeNanos();
  }

  private void consider(Location l) {
    if (fresh(l) && (best == null || !fresh(best) || l.getAccuracy() < best.getAccuracy()))
      best = new Location(l);
  }

  @Override
  public void onLocationChanged(Location location) {
    if (callback == null) return;
    consider(location);
    if (best != null && best.getAccuracy() <= 25) finish();
  }

  private void finish() {
    Callback cb = callback;
    Location result = fresh(best) ? best : null;
    cancel();
    if (cb == null) return;
    if (result == null)
      cb.failure(
          "Não foi possível obter uma posição recente. Tente ao ar livre ou escolha no mapa.");
    else cb.success(result);
  }

  private void fail(String text) {
    Callback cb = callback;
    cancel();
    if (cb != null) cb.failure(text);
  }

  public void cancel() {
    handler.removeCallbacks(timeout);
    try {
      manager.removeUpdates(this);
    } catch (SecurityException ignored) {
    }
    callback = null;
    best = null;
  }

  @Override
  public void onProviderDisabled(String provider) {}

  @Override
  public void onProviderEnabled(String provider) {}

  @Override
  public void onStatusChanged(String provider, int status, Bundle extras) {}
}
