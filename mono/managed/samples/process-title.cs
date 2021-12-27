/*
dotnet csc process-title.cs /r:webcs.exe
process-title
*/
using System;
using System.IO;

class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        string header = "NEW_TITLE_";
        string title = p.TabTitle;
        int oldVal = 0;
        if (title.StartsWith(header) && int.TryParse(title.Substring(header.Length), out oldVal))
        {
            oldVal += 1;
            p.TabTitle = header + oldVal.ToString().PadLeft(3, '0');
        }
        else
        {
            p.TabTitle = header + "001";
        }
        p.WriteLine("Changed the tab title from '" + title + "' to '" + p.TabTitle + "'. Use `termname Term` to reset it.");
        p.Exit();
    }
    static void Main(){}
}