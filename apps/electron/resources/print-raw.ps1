# Envia bytes crus (ESC/POS) direto pro spooler do Windows como datatype "RAW"
# — a impressora recebe exatamente os bytes enviados, sem o driver reinterpretar
# como texto/gráfico via GDI. Necessário pra comandos de controle (corte,
# abertura de gaveta) funcionarem, não só texto. Padrão clássico via P/Invoke
# de winspool.drv (KB Q322090), sem addon nativo — só .NET já embutido no
# Windows. Chamado pelo Main process do Electron (windows-raw-printer.driver.ts).
#
# Testado de verdade nesta sprint contra a impressora de referência (Elgin
# L42 Pro Full) cadastrada no Windows desta máquina: WritePrinter aceita os
# bytes (retorna OK) e o job aparece na fila de impressão real do Windows
# como "EasyPDV Raw Print" — a impressora física ainda não estava conectada
# nesse teste, então a impressão em si (papel saindo, corte) segue sem
# confirmação visual até o usuário conectar o hardware. Ver docs/ELECTRON.md.

param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes, out string error)
    {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        Int32 dwWritten = 0;
        bool bSuccess = false;
        di.pDocName = "EasyPDV Raw Print";
        di.pDataType = "RAW";
        error = "";

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                else { error = "StartPagePrinter failed: " + Marshal.GetLastWin32Error(); }
                EndDocPrinter(hPrinter);
            }
            else { error = "StartDocPrinter failed: " + Marshal.GetLastWin32Error(); }
            ClosePrinter(hPrinter);
        }
        else { error = "OpenPrinter failed: " + Marshal.GetLastWin32Error(); }
        return bSuccess;
    }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$errorMsg = ""
$result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes, [ref]$errorMsg)
if ($result) { Write-Output "OK" } else { Write-Output "FAIL: $errorMsg"; exit 1 }
