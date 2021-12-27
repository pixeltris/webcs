// %WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe webcs.cs
// NOTE: V1 is for the old mono/mono wasm implementation (TODO: remove?)
//#define V1
using System;
using System.IO;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Xml;
using System.Text;
using System.Diagnostics;

#if V1
namespace WebAssembly
{
    internal static class Runtime
    {
        [MethodImpl(MethodImplOptions.InternalCall)]
        internal static extern string InvokeJS(string str, out int exceptionalResult);
    }
}
#endif
static class Interop
{
    internal static class Runtime
    {
#if V1
        internal static string InvokeJS(string str, out int exceptionalResult) { return WebAssembly.Runtime.InvokeJS(str, out exceptionalResult); }
#else
        [MethodImpl(MethodImplOptions.InternalCall)]
        internal static extern string InvokeJS(string str, out int exceptionalResult);
#endif
    }
}

abstract class WebcsCompiler
{
    public abstract string Name { get; }
    public abstract void Init();
    public abstract string[] GetLanguageVersions();
    public abstract bool Compile(long tabId, string dir, string assemblyName, string outPath, bool asDll, bool debugSymbols, bool allowUnsafe, HashSet<string> sourceFiles, HashSet<string> references);
    public string GetOutPath(string assemblyName, bool asDll, string dir, string outPath)
    {
        if (!string.IsNullOrEmpty(outPath))
        {
            if (!outPath.Contains("/"))
            {
                outPath = Path.Combine(dir, outPath);
            }
        }
        else
        {
            outPath = Path.Combine(dir, GetFileName(assemblyName, asDll));
        }
        return outPath;
    }
    public string GetFileName(string assemblyName, bool asDll)
    {
        return assemblyName + (asDll ? ".dll" : ".exe");
    }
    protected string[] GetLanguageVersionsFromEnum(Type enumType, string header)
    {
        List<string> result = new List<string>();
        foreach (string name in Enum.GetNames(enumType))
        {
            if (name.StartsWith(header))
            {
                result.Add(name.Substring(header.Length));
            }
        }
        return result.ToArray();
    }
}

class WebcsCompilerRoslyn : WebcsCompiler
{
    // https://www.nuget.org/packages/Microsoft.CodeAnalysis.CSharp - 4.0.1
    // https://www.nuget.org/packages/Microsoft.CodeAnalysis - 4.0.1
    
    Assembly assembly;
    Assembly assemblyB;
    Type CSharpCompilation_Type;
    MethodInfo CSharpCompilation_Create;
    MethodInfo CSharpCompilation_WithOptions;
    MethodInfo CSharpCompilation_AddReferences;
    MethodInfo CSharpCompilation_AddSyntaxTrees;
    PropertyInfo CSharpCompilation_Options;
    MethodInfo CSharpCompilation_GetDiagnostics;
    MethodInfo CSharpCompilationOptions_WithOutputKind;
    MethodInfo CSharpCompilationOptions_WithConcurrentBuild;
    MethodInfo CSharpCompilationOptions_WithAllowUnsafe;
    Type MetadataReference_Type;
    Type SyntaxTree_Type;
    Type CSharpSyntaxTree_Type;
    Type CSharpCompilationOptions_Type;
    Type OutputKind_Type;
    Type MetadataReferenceProperties_Type;
    Type DocumentationProvider_Type;
    Type CSharpParseOptions_Type;
    Type Diagnostic_Type;
    Type Compilation_Type;
    Type ResourceDescription_Type;
    Type EmitOptions_Type;
    Type LanguageVersion_Type;
    MethodInfo CSharpSyntaxTree_ParseText;
    MethodInfo MetadataReference_CreateFromImage;
    PropertyInfo Diagnostic_Severity;
    MethodInfo Compilation_Emit;
    
    public override string Name
    {
        get { return "roslyn"; }
    }
    
    public override void Init()
    {
        try
        {
            Type enumerableType = typeof(IEnumerable<>);
            
            assemblyB = Assembly.Load("Microsoft.CodeAnalysis.dll");
            assembly = Assembly.Load("Microsoft.CodeAnalysis.CSharp.dll");
            string nsB = "Microsoft.CodeAnalysis.";
            string ns = "Microsoft.CodeAnalysis.CSharp.";
            MetadataReference_Type = assemblyB.GetType(nsB + "MetadataReference");
            SyntaxTree_Type = assemblyB.GetType(nsB + "SyntaxTree");
            CSharpSyntaxTree_Type = assembly.GetType(ns + "CSharpSyntaxTree");
            CSharpCompilationOptions_Type = assembly.GetType(ns + "CSharpCompilationOptions");
            CSharpCompilation_Type = assembly.GetType(ns + "CSharpCompilation");
            OutputKind_Type = assemblyB.GetType(nsB + "OutputKind");
            MetadataReferenceProperties_Type = assemblyB.GetType(nsB + "MetadataReferenceProperties");
            DocumentationProvider_Type = assemblyB.GetType(nsB + "DocumentationProvider");
            CSharpParseOptions_Type = assembly.GetType(ns + "CSharpParseOptions");
            Diagnostic_Type = assemblyB.GetType(nsB + "Diagnostic");
            Compilation_Type = assemblyB.GetType(nsB + "Compilation");
            ResourceDescription_Type = assemblyB.GetType(nsB + "ResourceDescription");
            EmitOptions_Type = assemblyB.GetType(nsB + "Emit.EmitOptions");
            LanguageVersion_Type = assembly.GetType(ns + "LanguageVersion");
            CSharpCompilation_Create = CSharpCompilation_Type.GetMethod("Create", new Type[] { typeof(string), enumerableType.MakeGenericType(SyntaxTree_Type), enumerableType.MakeGenericType(MetadataReference_Type), CSharpCompilationOptions_Type });
            CSharpCompilation_WithOptions = CSharpCompilation_Type.GetMethod("WithOptions", new Type[] { CSharpCompilationOptions_Type });
            CSharpCompilation_AddReferences = CSharpCompilation_Type.GetMethod("AddReferences", new Type[] { enumerableType.MakeGenericType(MetadataReference_Type) });
            CSharpCompilation_AddSyntaxTrees = CSharpCompilation_Type.GetMethod("AddSyntaxTrees", new Type[] { enumerableType.MakeGenericType(SyntaxTree_Type) });
            CSharpCompilation_Options = CSharpCompilation_Type.GetProperty("Options", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
            CSharpCompilation_GetDiagnostics = CSharpCompilation_Type.GetMethod("GetDiagnostics", new Type[] { typeof(System.Threading.CancellationToken) });
            CSharpCompilationOptions_WithOutputKind = CSharpCompilationOptions_Type.GetMethod("WithOutputKind", new Type[] { OutputKind_Type });
            CSharpCompilationOptions_WithConcurrentBuild = CSharpCompilationOptions_Type.GetMethod("WithConcurrentBuild", new Type[] { typeof(bool) });
            CSharpCompilationOptions_WithAllowUnsafe = CSharpCompilationOptions_Type.GetMethod("WithAllowUnsafe", new Type[] { typeof(bool) });
            CSharpSyntaxTree_ParseText = CSharpSyntaxTree_Type.GetMethod("ParseText", new Type[] { typeof(string), CSharpParseOptions_Type, typeof(string), typeof(Encoding), typeof(System.Threading.CancellationToken) });
            MetadataReference_CreateFromImage = MetadataReference_Type.GetMethod("CreateFromImage", new Type[] { enumerableType.MakeGenericType(typeof(byte)), MetadataReferenceProperties_Type, DocumentationProvider_Type, typeof(string) });
            Diagnostic_Severity = Diagnostic_Type.GetProperty("Severity", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
            Compilation_Emit = Compilation_Type.GetMethod("Emit", new Type[] { typeof(Stream), typeof(Stream), typeof(Stream), typeof(Stream), enumerableType.MakeGenericType(ResourceDescription_Type), EmitOptions_Type, typeof(System.Threading.CancellationToken) });
        }
        catch (Exception e)
        {
            Console.WriteLine("Failed to init roslyn. Exception: " + e);
        }
    }
    
    public override string[] GetLanguageVersions()
    {
        return GetLanguageVersionsFromEnum(LanguageVersion_Type, "CSharp");
    }
    
    public override bool Compile(long tabId, string dir, string assemblyName, string outPath, bool asDll, bool debugSymbols, bool allowUnsafe, HashSet<string> sourceFiles, HashSet<string> references)
    {
        object compilation = CSharpCompilation_Create.Invoke(null, new object[] { assemblyName, null, null, null });
        
        object options = CSharpCompilation_Options.GetValue(compilation);
        options = CSharpCompilationOptions_WithOutputKind.Invoke(options, new object[] { Enum.Parse(OutputKind_Type, asDll ? "DynamicallyLinkedLibrary" : "ConsoleApplication") });
        options = CSharpCompilationOptions_WithConcurrentBuild.Invoke(options, new object[] { false });// Concurrent hits issues with Tasks / Monitor.ObjWait not implemented on wasm
        options = CSharpCompilationOptions_WithAllowUnsafe.Invoke(options, new object[] { allowUnsafe });
        compilation = CSharpCompilation_WithOptions.Invoke(compilation, new object[] { options });
        
        var mdReferences = (System.Collections.IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(MetadataReference_Type));
        foreach (string reference in references)
        {
            byte[] buffer = null;
            string str = Webcs.InvokeJS("uiGetAssemblyOffsetSize('" + reference + "')");
            string[] splitted = str.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            if (splitted.Length == 2)
            {
                // Fetch the assembly off the heap
                long offset = long.Parse(splitted[0]);
                long size = long.Parse(splitted[1]);
                buffer = new byte[size];
                Marshal.Copy((IntPtr)offset, buffer, 0, buffer.Length);
            }
            else
            {
                string path = Path.Combine(dir, reference);
                if (File.Exists(path))
                {
                    buffer = File.ReadAllBytes(path);
                }
            }
            if (buffer == null)
            {
                Webcs.WriteError(tabId, "Failed to find reference '" + reference + "'");
                return false;
            }
            object mdRef = MetadataReference_CreateFromImage.Invoke(null, new object[] { buffer, Activator.CreateInstance(MetadataReferenceProperties_Type), null, reference });
            mdReferences.Add(mdRef);
        }
        compilation = CSharpCompilation_AddReferences.Invoke(compilation, new object[] { mdReferences });
        
        var syntaxTrees = (System.Collections.IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(SyntaxTree_Type));
        foreach (string sourceFile in sourceFiles)
        {
            if (File.Exists(sourceFile))
            {
                // TODO: Add support for language version (CSharpParseOptions ctor which is second param to ParseText - or get CSharpParseOptions.Default (static property) then call WithLanguageVersion)
                string text = File.ReadAllText(sourceFile);
                object syntaxTree = CSharpSyntaxTree_ParseText.Invoke(null, new object[] { text, null, sourceFile, Encoding.UTF8, null });
                syntaxTrees.Add(syntaxTree);
            }
            else
            {
                Webcs.WriteError(tabId, "Source file not found '" + sourceFile + "'");
            }
        }
        compilation = CSharpCompilation_AddSyntaxTrees.Invoke(compilation, new object[] { syntaxTrees });
        
        bool error = false;
        object diagnostics = CSharpCompilation_GetDiagnostics.Invoke(compilation, new object[] { null });
        foreach (object diag in diagnostics as System.Collections.IList)
        {
            object severity = Diagnostic_Severity.GetValue(diag);
            switch (severity.ToString())
            {
                case "Info":
                    Webcs.WriteLine(tabId, "[INFO] " + diag.ToString());
                    break;
                case "Warning":
                    Webcs.WriteLine(tabId, "[WARNING] " + diag.ToString());
                    break;
                case "Error":
                    error = true;
                    Webcs.WriteError(tabId, diag.ToString());
                    break;
            }
        }
        
        if (error)
        {
            return false;
        }
        
        using (MemoryStream stream = new MemoryStream())
        using (MemoryStream pdbStream = (debugSymbols ? new MemoryStream() : null))
        {
            Compilation_Emit.Invoke(compilation, new object[] { stream, pdbStream, null, null, null, null, null });
            File.WriteAllBytes(outPath, stream.ToArray());
            if (pdbStream != null)
            {
                File.WriteAllBytes(Path.ChangeExtension(outPath, ".pdb"), pdbStream.ToArray());
            }
        }
        return true;
    }
}

class WebcsCompilerMcs : WebcsCompiler
{
    // mcs.exe was taken from https://download.mono-project.com/archive/6.12.0/macos-10-universal/MonoFramework-MDK-6.12.0.107.macos10.xamarin.universal.pkg
    // - MonoFramework-MDK-6.12.0.107.macos10.xamarin.universal.pkg/Payload~/./Library/Frameworks/Mono.framework/Versions/6.12.0/lib/mono/4.5/mcs.exe
    //
    // mcs.exe edits (via dnSpy):
    // - Edit "StaticLoader" ctor to point to "/sdk/" and a new static field called "CurrentDirectory"
    // - Edit "Driver.Main" to remove Environment.Exit calls (these kill mono)
    // - Edit "ComandLineParser.ParseArguments" so that '/' char is no longer a command line flag and full paths can be provided
    // TODO: Add support to StaticLoader for loading assemblies from memory rather than from files (avoid duplicate "sdk" load)
    
    Assembly assembly;
    Type Driver_Type;
    MethodInfo Driver_Main;
    Type LanguageVersion_Type;
    Type StaticLoader_Type;
    FieldInfo StaticLoader_CurrentDirectory;
    
    public override string Name
    {
        get { return "mcs"; }
    }
    
    public override void Init()
    {
        try
        {
            assembly = Assembly.Load("mcs.exe");
            Driver_Type = assembly.GetType("Mono.CSharp.Driver");
            Driver_Main = Driver_Type.GetMethod("Main");
            LanguageVersion_Type = assembly.GetType("Mono.CSharp.LanguageVersion");
            StaticLoader_Type = assembly.GetType("Mono.CSharp.StaticLoader");
            StaticLoader_CurrentDirectory = StaticLoader_Type.GetField("CurrentDirectory");
            
        }
        catch (Exception e)
        {
            Console.WriteLine("Failed to init mcs. Exception: " + e);
        }
    }
    
    public override string[] GetLanguageVersions()
    {
        return GetLanguageVersionsFromEnum(LanguageVersion_Type, "V_");
    }
    
    public override bool Compile(long tabId, string dir, string assemblyName, string outPath, bool asDll, bool debugSymbols, bool allowUnsafe, HashSet<string> sourceFiles, HashSet<string> references)
    {
        if (!Directory.Exists("/sdk/"))
        {
            Webcs.WriteError(tabId, "/sdk/ is required to compile with mcs.exe (see dotnet-extra.js)");
            return false;
        }
        
        List<string> args = new List<string>();
        foreach (string file in sourceFiles)
        {
            args.Add(file);
        }
        foreach (string reference in references)
        {
            args.Add("-r:" + reference);
        }
        if (debugSymbols)
        {
            args.Add("-debug");
        }
        if (asDll)
        {
            args.Add("-target:library");
        }
        if (allowUnsafe)
        {
            args.Add("-unsafe");
        }
        args.Add("-out:" + outPath);
        StaticLoader_CurrentDirectory.SetValue(null, Webcs.GetTabWorkingDirectory(tabId));
        // NOTE: Really we should re-implement Driver.Main to output to our own TextWriter, but this will do for now
        TextWriter tmpOut = Console.Out;
        TextWriter tmpError = Console.Error;
        try
        {
            using (TextWriter newTextOut = new WebcsTextWriter(tabId, false))
            using (TextWriter newTextError = new WebcsTextWriter(tabId, true))
            {
                Console.SetOut(newTextOut);
                Console.SetError(newTextError);
                object result = Driver_Main.Invoke(null, new object[] { args.ToArray() });
                return ((int)result) == 0;
            }
        }
        finally
        {
            Console.SetOut(tmpOut);
            Console.SetError(tmpError);
        }
    }
}

static class WebcsCompilerHelper
{
    internal static void Compile(long tabId, string csprojPath)
    {
        CompileInternal(tabId, csprojPath, null);
    }
    
    internal static void CompileCsc(long tabId, string argsString)
    {
        string[] args = argsString.Split(new char[] { '\r' }, StringSplitOptions.RemoveEmptyEntries);
        CompileInternal(tabId, null, args);
    }
    
    static string FixupReferenceName(string reference)
    {
        switch (Path.GetExtension(reference).ToLower())
        {
            case ".exe":
            case ".dll":
                break;
            default:
                reference += ".dll";
                break;
        }
        return reference;
    }
    
    static void CompileInternal(long tabId, string csprojPath, string[] cscArgs)
    {
        Stopwatch stopwatch = new Stopwatch();
        stopwatch.Start();
        
        string dir = null;
        string outputDir = null;
        string assemblyName = null;
        bool asDll = false;
        bool debugSymbols = false;
        bool debugSymbolsForced = false;// Temporary
        bool allowUnsafe = true;// Enable by default (because why not)
        HashSet<string> references = new HashSet<string>();
        HashSet<string> sourceFiles = new HashSet<string>();
        
        if (csprojPath == null && cscArgs == null)
        {
            Webcs.WriteError(tabId, "csproj not found");
            return;
        }

        if (csprojPath != null)
        {
            if (!File.Exists(csprojPath))
            {
                Webcs.WriteError(tabId, "File not found '" + csprojPath + "'");
                return;
            }
            csprojPath = Path.GetFullPath(csprojPath);
            dir = Path.GetDirectoryName(csprojPath).TrimEnd('/') + '/';
            assemblyName = Path.GetFileNameWithoutExtension(csprojPath);
            
            // Hack to avoid annoying XmlNamespaceManager stuff
            string[] lines = File.ReadAllLines(csprojPath);
            for (int i = 0; i < lines.Length; i++)
            {
                if (lines[i].Trim().StartsWith("<Project") && lines[i].Contains("xmlns"))
                {
                    lines[i] = "<Project>";
                    break;
                }
            }
            
            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(string.Join(string.Empty, lines));
            XmlNode projectNode = xmlDoc.SelectSingleNode("Project");
            if (projectNode == null)
            {
                Webcs.WriteError(tabId, "Failed to find 'Project' element");
                return;
            }
            if (projectNode.Attributes["Sdk"] != null)
            {
                IncludePathRecursive(tabId, sourceFiles, dir, "*.cs");
            }
            XmlNodeList propertyGroups = projectNode.SelectNodes("PropertyGroup");
            foreach (XmlNode propGroup in propertyGroups)
            {
                foreach (XmlNode childNode in propGroup.ChildNodes)
                {
                    switch (childNode.Name)
                    {
                        case "AssemblyName":
                            if (!string.IsNullOrEmpty(childNode.InnerText))
                            {
                                assemblyName = childNode.InnerText;
                            }
                            break;
                        case "OutputType":
                            switch (childNode.InnerText.ToLower())
                            {
                                case "exe":
                                    asDll = false;
                                    break;
                                case "dll":
                                    asDll = true;
                                    break;
                            }
                            break;
                        case "DebugType":
                            switch (childNode.InnerText.ToLower())
                            {
                                case "full":
                                case "pdbonly":
                                    debugSymbols = true;
                                    break;
                                case "none":
                                default:
                                    debugSymbols = false;
                                    break;
                            }
                            break;
                        case "DebugSymbols":
                            bool.TryParse(childNode.InnerText, out debugSymbols);
                            break;
                        case "DebugSymbolsForced":// Temporary
                            bool.TryParse(childNode.InnerText, out debugSymbolsForced);
                            break;
                        case "OutputPath":
                        case "OutDir":
                            outputDir = childNode.InnerText.Replace("\\", "/");
                            break;
                        case "AllowUnsafeBlocks":
                            bool.TryParse(childNode.InnerText, out allowUnsafe);
                            break;
                    }
                }
            }
            XmlNodeList itemGroups = projectNode.SelectNodes("ItemGroup");
            foreach (XmlNode itemGroup in itemGroups)
            {
                foreach (XmlNode childNode in itemGroup.ChildNodes)
                {
                    switch (childNode.Name)
                    {
                        case "Compile":
                            {
                                XmlAttribute includeAttribute = childNode.Attributes["Include"];
                                if (includeAttribute != null && !string.IsNullOrEmpty(includeAttribute.InnerText))
                                {
                                    if (!IncludePath(tabId, sourceFiles, dir, includeAttribute.InnerText.Replace("\\", "/")))
                                    {
                                        return;
                                    }
                                }
                                XmlAttribute removeAttribute = childNode.Attributes["Remove"];
                                if (removeAttribute != null && !string.IsNullOrEmpty(removeAttribute.InnerText))
                                {
                                    if (!ExcludePath(tabId, sourceFiles, dir, removeAttribute.InnerText.Replace("\\", "/")))
                                    {
                                        return;
                                    }
                                }
                            }
                            break;
                        case "Reference":
                            {
                                XmlAttribute includeAttribute = childNode.Attributes["Include"];
                                if (includeAttribute != null && !string.IsNullOrEmpty(includeAttribute.InnerText))
                                {
                                    references.Add(FixupReferenceName(includeAttribute.InnerText.Replace("\\", "/")));
                                }
                            }
                            break;
                        case "PackageReference":
                            {
                                // Is accessing nuget possible? CORS?
                                XmlAttribute includeAttribute = childNode.Attributes["Include"];
                                XmlAttribute versionAttribute = childNode.Attributes["Version"];
                                if (includeAttribute != null && !string.IsNullOrEmpty(includeAttribute.InnerText))
                                {
                                }
                            }
                            break;
                    }
                }
            }
        }
        else if (cscArgs != null)
        {
            dir = Webcs.GetTabWorkingDirectory(tabId);
            for (int i = 0; i < cscArgs.Length; i++)
            {
                string arg = cscArgs[i];
                if (arg.StartsWith("-") || (arg.StartsWith("/") && arg.Contains(":")))
                {
                    string key = null, value = null;
                    arg = arg.TrimStart(arg[0]);
                    bool isMinus = false;
                    int colonIndex = arg.IndexOf(":");
                    if (colonIndex == 0)
                    {
                        continue;
                    }
                    else if (colonIndex > 0)
                    {
                        key = arg.Substring(0, colonIndex);
                        value = arg.Substring(colonIndex + 1);
                    }
                    else
                    {
                        if (arg.EndsWith("+") || (isMinus = arg.EndsWith("-")))
                        {
                            key = arg.TrimEnd(arg[arg.Length - 1]);
                        }
                        else
                        {
                            key = arg;
                        }
                    }
                    if (key == null)
                    {
                        continue;
                    }
                    switch (key.ToLower())
                    {
                        case "t":
                        case "target":
                            if (value != null)
                            {
                                switch (value.ToLower())
                                {
                                    case "exe":
                                        asDll = false;
                                        break;
                                    case "dll":
                                    case "library":
                                        asDll = true;
                                        break;
                                }
                            }
                            break;
                        case "out":
                            assemblyName = value;
                            break;
                        case "r":
                        case "reference":
                            if (value != null)
                            {
                                references.Add(FixupReferenceName(value));
                            }
                            break;
                        case "debug":
                            debugSymbols = !isMinus;
                            break;
                        case "debugforced":// Temporary
                            debugSymbolsForced = !isMinus;
                            break;
                        case "unsafe":
                            allowUnsafe = !isMinus;
                            break;
                        case "recurse":
                            if (value != null)
                            {
                                if (!IncludePathRecursive(tabId, sourceFiles, dir, value))
                                {
                                    return;
                                }
                            }
                            break;
                    }
                }
                else
                {
                    if (!IncludePath(tabId, sourceFiles, dir, arg))
                    {
                        return;
                    }
                }
            }
            if (assemblyName != null)
            {
                try
                {
                    string path = assemblyName;
                    path = GetFullPathFromDir(dir, path);
                    outputDir = Path.GetDirectoryName(path);
                    assemblyName = Path.GetFileNameWithoutExtension(assemblyName);
                }
                catch (Exception e)
                {
                    Webcs.WriteError(tabId, "Failed processing out path. Exception: " + e);
                    return;
                }
            }
            if (assemblyName == null)
            {
                foreach (string sourceFile in sourceFiles)
                {
                    try
                    {
                        assemblyName = Path.GetFileNameWithoutExtension(sourceFile);
                        break;
                    }
                    catch
                    {
                    }
                }
            }
            if (assemblyName == null)
            {
                Webcs.WriteError(tabId, "Failed to determine assembly name");
                return;
            }
        }

#if V1
        references.Add("System.dll");
        references.Add("netstandard.dll");
        references.Add("mscorlib.dll");
        references.Add("System.Console.dll");
#else
        // NOTE: This is bad (we're depending on "System.Private.XXX") but it's all we have to work with... (avoid saving / using any assemblies compiled with this!)
        //       Could maybe pull in Microsoft.NETCore.App.Ref dlls? But it would be a lot of additional download bloat. See https://github.com/dotnet/roslyn-sdk/blob/0408271325bb067fd5f84592a545e8280cedff39/src/Microsoft.CodeAnalysis.Testing/Microsoft.CodeAnalysis.Analyzer.Testing/ReferenceAssemblies.cs#L798
        references.Add("System.dll");
        references.Add("System.Private.CoreLib.dll");
        references.Add("mscorlib.dll");
        if (references.Contains("System.Xml.dll"))
        {
            references.Add("System.Private.Xml.dll");
        }
        references.Add("System.Console.dll");
        references.Add("System.Runtime.dll");
#endif
        if (Webcs.activeCompiler == null)
        {
            Webcs.WriteError(tabId, "Compiler is null");
            return;
        }
        string outPath = null;
        if (outputDir != null)
        {
            bool exists = true;
            try
            {
                outputDir = GetFullPathFromDir(dir, outputDir);
                if (Directory.Exists(outputDir))
                {
                    outPath = Path.Combine(outputDir, Webcs.activeCompiler.GetFileName(assemblyName, asDll));
                }
                else
                {
                    exists = false;
                }
            }
            catch
            {
                exists = false;
            }
            if (!exists)
            {
                Webcs.WriteWarning(tabId, "Failed to find output dir '" + outputDir + "'");
                //return;
            }
        }
        if (string.IsNullOrEmpty(outPath))
        {
            outPath = Webcs.activeCompiler.GetOutPath(assemblyName, asDll, dir, outPath);
        }
        // FIXME: Both mcs and roslyn have issues with debug symbols (mcs uses a hash function and roslyn uses Monitor.ObjWait, both of which aren't supported on wasm builds)
        debugSymbols = false;
        if (debugSymbolsForced && Webcs.activeCompiler.GetType() == typeof(WebcsCompilerRoslyn))
        {
            debugSymbols = true;
            // Temporary. Roslyn can produce pdb files, but it will often fail as it tries to wait on a task (Task.Result):
            //   System.Threading.Monitor.ObjWait
            //   ...
            //   Microsoft.Cci.DebugSourceDocument.GetSourceInfo
            //   Microsoft.Cci.MetadataWriter.AddDocument
            //   Microsoft.Cci.MetadataWriter.BuildMetadataAndIL
            //   Microsoft.Cci.PeWriter.WritePeToStream
            //   Microsoft.CodeAnalysis.Compilation.SerializePeToStream
            //   Microsoft.CodeAnalysis.Compilation.Emit
        }
        //Webcs.WriteLine(tabId, "tabid:" + tabId + " dir:" + dir + " assemblyName:" + assemblyName + " asDll:" + asDll + " ds:" + debugSymbols + " unsafe:" + allowUnsafe + " sourceFiles:" + string.Join(",", sourceFiles) + " references:" + string.Join(",", references));
        try
        {
            if (Webcs.activeCompiler.Compile(tabId, dir, assemblyName, outPath, asDll, debugSymbols, allowUnsafe, sourceFiles, references))
            {
                Webcs.WriteLine(tabId, "Done " + stopwatch.Elapsed);
            }
        }
        catch (Exception e)
        {
            Webcs.WriteError(tabId, "Compile failed with exception: " + e);
        }
    }
    
    static bool ExcludePath(long tabId, HashSet<string> sourceFiles, string dir, string path)
    {
        bool excludeFail = false;
        try
        {
            string fullPath = GetFullPathFromDir(dir, path);
            fullPath = Path.GetFullPath(fullPath);
            FileAttributes attr = File.GetAttributes(fullPath);
            if ((attr & FileAttributes.Directory) == FileAttributes.Directory)
            {
                foreach (string sourceFile in new HashSet<string>(sourceFiles))
                {
                    if (sourceFile.StartsWith(fullPath))
                    {
                        sourceFiles.Remove(sourceFile);
                    }
                }
            }
            else
            {
                sourceFiles.Remove(fullPath);
            }
        }
        catch
        {
            excludeFail = true;
        }
        if (excludeFail)
        {
            Webcs.WriteError(tabId, "Exclude failed: " + path);
            return false;
        }
        return true;
    }
    
    static bool IncludePathRecursive(long tabId, HashSet<string> sourceFiles, string dir, string path)
    {
        bool recurseFailed = false;
        try
        {
            string filter = path;
            string baseDir = dir;
            int lastSlashIndex = path.LastIndexOf('/');
            if (lastSlashIndex >= 0)
            {
                baseDir = path.Substring(0, lastSlashIndex);
                filter = path.Substring(lastSlashIndex + 1);
                baseDir = GetFullPathFromDir(dir, baseDir);
            }
            if (Directory.Exists(baseDir))
            {
                baseDir = Path.GetFullPath(baseDir);
                if (filter == "*.cs" || filter == "*" || filter == "**.cs" || filter == "**")
                {
                    foreach (string file in Directory.GetFiles(baseDir, "*.cs", SearchOption.AllDirectories))
                    {
                        try
                        {
                            sourceFiles.Add(Path.GetFullPath(file));
                        }
                        catch
                        {
                        }
                    }
                }
                else
                {
                    recurseFailed = true;
                }
            }
            else
            {
                recurseFailed = true;
            }
        }
        catch
        {
            recurseFailed = true;
        }
        if (recurseFailed)
        {
            Webcs.WriteError(tabId, "Recurse failed: " + path);
            return false;
        }
        return true;
    }
    
    static bool IncludePath(long tabId, HashSet<string> sourceFiles, string dir, string path)
    {
        if (path == "**" || path == "**.cs" || path.EndsWith("/**.cs") || path.EndsWith("/**"))
        {
            return IncludePathRecursive(tabId, sourceFiles, dir, path);
        }
        if (path == "*" || path == "*.cs" || path.EndsWith("/*.cs") || path.EndsWith("/*"))
        {
            bool searchFailed = false;
            try
            {
                string baseDir = null;
                int lastSlashIndex = path.LastIndexOf('/');
                if (lastSlashIndex >= 0)
                {
                    baseDir = path.Substring(0, lastSlashIndex);
                }
                if (baseDir != null)
                {
                    baseDir = GetFullPathFromDir(dir, baseDir);
                }
                else
                {
                    baseDir = dir;
                }
                if (baseDir != null && Directory.Exists(baseDir))
                {
                    baseDir = Path.GetFullPath(baseDir);
                    foreach (string file in Directory.GetFiles(baseDir, "*.cs"))
                    {
                        try
                        {
                            sourceFiles.Add(Path.GetFullPath(file));
                        }
                        catch
                        {
                        }
                    }
                }
                else
                {
                    searchFailed = true;
                }
            }
            catch
            {
                searchFailed = true;
            }
            if (searchFailed)
            {
                Webcs.WriteError(tabId, "Search failed: " + path);
                return false;
            }
        }
        else
        {
            try
            {
                string filePath = GetFullPathFromDir(dir, path);
                filePath = Path.GetFullPath(filePath);
                if (File.Exists(filePath))
                {
                    sourceFiles.Add(filePath);
                }
                else
                {
                    Webcs.WriteError(tabId, "Couldn't find source file '" + path + "'");
                    return false;
                }
            }
            catch
            {
            }
        }
        return true;
    }
    
    static string GetFullPathFromDir(string dir, string path)
    {
        if (!path.StartsWith("/"))
        {
            path = Path.Combine(dir, path);
        }
        return path;
    }
}

class WebcsTextWriter : TextWriter
{
    StringBuilder sb = new StringBuilder();
    long tabId;
    bool isError;
    
    public override Encoding Encoding
    {
        get { return Encoding.UTF8; }
    }
    
    public WebcsTextWriter(long tabId, bool isError)
    {
        this.tabId = tabId;
        this.isError = isError;
    }
    
    public override void Write(char c)
    {
        if (c == '\n')
        {
            if (isError)
            {
                Webcs.WriteError(tabId, sb.ToString());
            }
            else
            {
                Webcs.WriteLine(tabId, sb.ToString());
            }
            sb.Clear();
        }
        else if (c != '\r')
        {
            sb.Append(c);
        }
    }
}

public class WebcsProcess
{
    private Action<string> readlineCallback;
    public event Action OnTabClosed;
    public event Action OnExit;
    public event Action OnKill;
    public long Id { get; private set; }
    public long TabId { get; private set; }
    public string TabTitle
    {
        get { return Webcs.GetTabTitle(TabId); }
        set { Webcs.SetTabTitle(TabId, value); }
    }
    public string[] Args { get; private set; }
    public string CurrentDirectory { get; set; }
    
    public WebcsProcess(long tabId, long processId, string[] args)
    {
        TabId = tabId;
        Id = processId;
        Args = args;
        CurrentDirectory = Webcs.GetTabWorkingDirectory(tabId);
    }

    public void WriteLine(string str)
    {
        Webcs.WriteLine(TabId, str);
    }
    
    public void ReadLine(string promptText, Action<string> callback)
    {
        readlineCallback = callback;
        Webcs.ProcessReadLine(Id, promptText);
    }
    
    public void CloseTab()
    {
        Webcs.CloseTab(TabId);
    }
    
    public void Exit(int exitCode = 0)
    {
        Webcs.ProcessExit(Id, exitCode);
    }
    
    public void Kill()
    {
        Webcs.ProcessKill(Id);
    }
    
    internal void OnTabClosedInternal()
    {
        if (OnTabClosed != null)
        {
            OnTabClosed();
        }
    }
    
    internal void OnReadLine(string str)
    {
        Action<string> callback = readlineCallback;
        readlineCallback = null;
        if (callback != null)
        {
            callback(str);
        }
    }
    
    internal void OnProcessExit()
    {
        if (OnExit != null)
        {
            OnExit();
        }
    }
    
    internal void OnProcessKill()
    {
        if (OnKill != null)
        {
            OnKill();
        }
    }
}

public static class Webcs
{
    internal static Dictionary<long, WebcsProcess> processes = new Dictionary<long, WebcsProcess>();
    internal static Dictionary<string, WebcsCompiler> compilers = new Dictionary<string, WebcsCompiler>();
    internal static WebcsCompiler activeCompiler;
    
    static WebcsTextWriter consoleOut;
    static WebcsTextWriter consoleError;
    static TextWriter consoleOutOriginal;
    static TextWriter consoleErrorOriginal;
    
    public static string InvokeJS(string str, out int exceptionalResult)
    {
        return Interop.Runtime.InvokeJS(str, out exceptionalResult);
    }
    
    public static string InvokeJS(string str)
    {
        int exc;
        return InvokeJS(str, out exc);
    }
    
    public static void CloseTab(long tabId)
    {
        InvokeJS("uiCloseTab(" + tabId + ")");
    }
    
    public static void SetTabTitle(long tabId, string title)
    {
        InvokeJS("uiSetTabTitle(" + tabId + ", '" + title + "')");
    }
    
    public static string GetTabTitle(long tabId)
    {
        return InvokeJS("uiGetTabTitle(" + tabId + ")");
    }
    
    public static string GetTabWorkingDirectory(long tabId)
    {
        return InvokeJS("uiGetTabWorkingDirectory(" + tabId + ")");
    }
    
    public static void WriteLine(long tabId, string str)
    {
        InvokeJS("uiTerminalWriteLine(" + tabId + ", `" + str.Replace("`", "\\`") + "`)");
    }
    
    public static void ProcessExit(long processId, int exitCode)
    {
        InvokeJS("uiProcessExit(" + processId + ", " + exitCode + ")");
    }
    
    public static void ProcessKill(long processId)
    {
        InvokeJS("uiProcessKill(" + processId + ")");
    }
    
    public static void ProcessReadLine(long processId, string promptText = null)
    {
        InvokeJS("uiProcessReadLine(" + processId + ", `" + promptText + "`)");
    }
    
    public static long GetActiveTabId()
    {
        string str = InvokeJS("uiGetActiveTabId()");
        long result;
        long.TryParse(str, out result);
        return result;
    }
    
    internal static void WriteError(long tabId, string str)
    {
        //Console.Error.WriteLine("[ERROR] " + str);
        WriteLine(tabId, "[ERROR] " + str);
    }
    
    internal static void WriteWarning(long tabId, string str)
    {
        //Console.Error.WriteLine("[WARNING] " + str);
        WriteLine(tabId, "[WARNING] " + str);
    }
    
    static void Compile(long tabId, string csprojPath)
    {
        WebcsCompilerHelper.Compile(tabId, csprojPath);
    }
    
    static void CompileCsc(long tabId, string argsString)
    {
        WebcsCompilerHelper.CompileCsc(tabId, argsString);
    }
    
    static void OnTabClosed(long tabId)
    {
        WebcsProcess process = null;
        foreach (WebcsProcess proc in processes.Values)
        {
            if (proc.TabId == tabId)
            {
                process = proc;
                break;
            }
        }
        if (process != null)
        {
            // NOTE: This might never get called if process Kill/Exit is called first
            process.OnTabClosedInternal();
        }
    }
    
    static void OnReadLine(long tabId, long processId, string str)
    {
        WebcsProcess process;
        if (processes.TryGetValue(processId, out process))
        {
            process.OnReadLine(str);
        }
    }
    
    static void OnProcessExit(long tabId, long processId)
    {
        WebcsProcess process;
        if (processes.TryGetValue(processId, out process))
        {
            process.OnProcessExit();
            processes.Remove(processId);
        }
    }
    
    static void OnProcessKill(long tabId, long processId)
    {
        WebcsProcess process;
        if (processes.TryGetValue(processId, out process))
        {
            process.OnProcessKill();
            processes.Remove(processId);
        }
    }
    
    static void RedirectConsole(long tabId)
    {
        if (consoleOut != null)
        {
            RestoreConsole();
        }
        try
        {
            consoleOut = new WebcsTextWriter(tabId, false);
            consoleError = new WebcsTextWriter(tabId, true);
        }
        catch
        {
            RestoreConsole();
        }
        if (consoleOut != null)
        {
            try
            {
                Console.SetOut(consoleOut);
                Console.SetError(consoleError);
            }
            catch
            {
                RestoreConsole();
            }
        }
    }
    
    static void RestoreConsole()
    {
        if (consoleOut != null)
        {
            try { consoleOut.Close(); } catch {}
            try { consoleError.Close(); } catch {}
            consoleOut = null;
            consoleError = null;
        }
        if (consoleOutOriginal != null)
        {
            try
            {
                Console.SetOut(consoleOutOriginal);
                Console.SetError(consoleErrorOriginal);
            }
            catch {}
        }
    }
    
    static bool RunMain(long tabId, long processId, string path, string argsString)
    {
        List<string> args = new List<string>(argsString.Split(new char[] { '\r' }, StringSplitOptions.RemoveEmptyEntries));
        if (processes.ContainsKey(processId))
        {
            WriteError(tabId, "Process already exists with an id of " + processId);
            return false;
        }
        if (!File.Exists(path))
        {
            WriteError(tabId, "Failed to find binary '" + path + "'");
            return false;
        }
        // This will leak memory on each run... maybe only do this one per build?
        // Hmm... LoadFile doesn't work here on re-compiled code?
        // Double hmm... going to have issues here if re-compiling a dependant dll?
        // This would be a lot better spinning up a worker and isolating each run... but that would require a project redesign
        Assembly assembly = Assembly.Load(File.ReadAllBytes(path));
        if (assembly == null)
        {
            WriteError(tabId, "Failed to load assembly '" + path + "'");
            return false;
        }
        MethodInfo entryPoint = assembly.EntryPoint;
        if (entryPoint == null)
        {
            WriteError(tabId, "Failed to find entry point for '" + path + "'");
            return false;
        }
        bool runMain = false;
        bool redirectConsoleOutput = false;
        for (int i = args.Count - 1; i >= 0; i--)
        {
            switch (args[i].ToLower())
            {
                case "--main":
                    args.RemoveAt(i);
                    redirectConsoleOutput = true;
                    runMain = true;
                    break;
                case "--mainc":
                    args.RemoveAt(i);
                    redirectConsoleOutput = false;
                    runMain = true;
                    break;
                case "--rdc":
                    args.RemoveAt(i);
                    redirectConsoleOutput = true;
                    break;
            }
        }
        MethodInfo mainMethod = null;
        bool runMainWithArgsParam = false;
        if (runMain)
        {
            mainMethod = entryPoint;
            if (mainMethod.ReturnType != typeof(void) && mainMethod.ReturnType != typeof(int))
            {
                // This should be one of the "async Task" signatures. As this code path is not really for async code display an error
                WriteError(tabId, "The 'async Task' Main method signature is not supported");
                return false;
            }
            ParameterInfo[] mainParams = mainMethod.GetParameters();
            if (mainParams.Length > 1)
            {
                WriteError(tabId, "Unsupported Main method signature (too many args)");
                return false;
            }
            if (mainParams.Length == 1)
            {
                Type mainArgType = mainParams[0].ParameterType;
                if (!mainArgType.IsArray || mainArgType.GetElementType() != typeof(string))
                {
                    WriteError(tabId, "Unsupported Main method signature (expected `string[]` (or no args) got `" + mainArgType + "`)");
                    return false;
                }
                runMainWithArgsParam = true;
            }
        }
        else
        {
            BindingFlags bindingFlags = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            mainMethod = entryPoint.DeclaringType.GetMethod("WebcsMain", bindingFlags, null, new Type[] { typeof(WebcsProcess) }, null);
            if (mainMethod == null)
            {
                WriteError(tabId, "Failed to find WebcsMain on type '" + entryPoint.DeclaringType + "' for assembly '" + path + "'. Try --main (but be careful / see docs)");
                return false;
            }
        }
        if (redirectConsoleOutput)
        {
            RedirectConsole(tabId);
        }
        WebcsProcess process = new WebcsProcess(tabId, processId, args.ToArray());
        processes[processId] = process;
        try
        {
            if (runMain)
            {
                mainMethod.Invoke(null, runMainWithArgsParam ? new object[] { (object)process.Args } : null);
            }
            else
            {
                mainMethod.Invoke(null, new object[] { (object)process });
            }
        }
        catch (Exception e)
        {
            WriteError(tabId, mainMethod.Name + " exception: " + e);
            ProcessKill(processId);
            return false;
        }
        finally
        {
            if (redirectConsoleOutput)
            {
                RestoreConsole();
            }
            if (runMain)
            {
                ProcessKill(processId);
            }
        }
        return true;
    }
    
    static bool SetCompiler(string name)
    {
        if (name == null)
        {
            return false;
        }
        WebcsCompiler compiler; 
        if (compilers.TryGetValue(name, out compiler))
        {
            activeCompiler = compiler;
            return true;
        }
        return false;
    }
    
    static string GetCompilers()
    {
        return string.Join(", ", compilers.Keys);
    }
    
    static string GetActiveCompiler()
    {
        return activeCompiler == null ? null : activeCompiler.Name;
    }
    
    static string GetActiveCompilerLanguageVersions()
    {
        return activeCompiler == null ? null : string.Join(", ", activeCompiler.GetLanguageVersions());
    }
    
    static void AddCompiler(WebcsCompiler compiler)
    {
        compilers[compiler.Name] = compiler;
        compiler.Init();
    }
    
    static void Main()
    {
        consoleOutOriginal = Console.Out;
        consoleErrorOriginal = Console.Error;
        
        AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(ResolveAssembly);
        AddCompiler(new WebcsCompilerRoslyn());
        AddCompiler(new WebcsCompilerMcs());
        SetCompiler("roslyn");
    }
    
    static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
    {
        string name = null;
        try
        {
            name = (new AssemblyName(args.Name)).Name;
        }
        catch {}
        if (!string.IsNullOrEmpty(name))
        {
            // TODO: Maybe look at args.RequestingAssembly to determine which processes are suitable for this lookup?
            foreach (WebcsProcess process in processes.Values)
            {
                string dir = GetTabWorkingDirectory(process.TabId);
                if (!string.IsNullOrEmpty(dir))
                {
                    string[] paths =
                    {
                        Path.Combine(dir, name + ".dll"),
                        Path.Combine(dir, name + ".exe")
                    };
                    foreach (string path in paths)
                    {
                        if (File.Exists(path))
                        {
                            try
                            {
                                return Assembly.Load(File.ReadAllBytes(path));
                            }
                            catch
                            {
                            }
                        }
                    }
                }
            }
        }
        Console.WriteLine("TODO: Attempt to resolve '" + args.Name + "'");
        return null;
    }
}