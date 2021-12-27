/*
dotnet csc async-loop.cs /r:webcs.exe
async-loop
*/
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

// Note that you can Ctrl+C this to abort the async code. If you were to do something similar in Main via --main there wouldn't be a way to abort the code and it would keep running (even though the virtual process would be dead).
class Program
{
    static void RunTask(CancellationTokenSource source, WebcsProcess p, int counter)
    {
        Task.Delay(1000, source.Token).ContinueWith(x =>
        {
            if (++counter >= 5)
            {
                p.WriteLine("Done!");
                p.Exit();
            }
            else
            {
                p.WriteLine("Async(" + counter + ")");
                RunTask(source, p, counter);
            }
        }, TaskContinuationOptions.NotOnCanceled);
    }
    static void WebcsMain(WebcsProcess p)
    {
        CancellationTokenSource source = new CancellationTokenSource();
        p.WriteLine("Running async...");
        RunTask(source, p, 0);
        p.OnKill += () =>
        {
            p.WriteLine("Aborted");
            source.Cancel();
        };
    }
    static void Main(){}
}