import java.io.File;
import java.lang.reflect.Method;

/** Fresh accessibility snapshot for animated screens; never waits for global idle. */
public final class GymDump {
  public static void main(String[] args) throws Exception {
    if (args.length != 3) throw new IllegalArgumentException("output width height required");
    File output = new File(args[0]);
    if (output.exists() && !output.delete()) throw new IllegalStateException("Cannot remove prior snapshot");
    Class<?> wrapperClass = Class.forName("com.android.uiautomator.core.UiAutomationShellWrapper");
    Object wrapper = wrapperClass.getDeclaredConstructor().newInstance();
    wrapperClass.getMethod("connect").invoke(wrapper);
    try {
      wrapperClass.getMethod("setCompressedLayoutHierarchy", boolean.class).invoke(wrapper, false);
      Object automation = wrapperClass.getMethod("getUiAutomation").invoke(wrapper);
      Method rootMethod = automation.getClass().getMethod("getRootInActiveWindow");
      Object root = null;
      for (int i = 0; i < 10 && root == null; i++) {
        Thread.sleep(250);
        root = rootMethod.invoke(automation);
      }
      if (root == null) throw new IllegalStateException("No active accessibility root");
      Class<?> nodeClass = Class.forName("android.view.accessibility.AccessibilityNodeInfo");
      Class.forName("com.android.uiautomator.core.AccessibilityNodeInfoDumper")
        .getMethod("dumpWindowToFile", nodeClass, File.class, int.class, int.class, int.class)
        .invoke(null, root, output, 0, Integer.parseInt(args[1]), Integer.parseInt(args[2]));
      if (!output.isFile() || output.length() == 0) throw new IllegalStateException("No fresh snapshot written");
    } finally {
      wrapperClass.getMethod("disconnect").invoke(wrapper);
    }
    System.out.println("Fresh hierarchy written: " + output);
    System.exit(0);
  }
}
