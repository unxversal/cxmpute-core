"use client"
import { 
    Sandpack,
    SandpackFileExplorer,
    SandpackProvider
} from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";
import styles from './threejs.module.css';
import { Redo, Redo2, Undo, Undo2 } from "lucide-react";

export default function Page(){
  
  return(
    // <SandpackProvider 
    //     template="react-ts" 
    //     theme="auto" 
    //     options={{
    //         externalResources: ["https://cdn.tailwindcss.com"],
    //         visibleFiles:["/App.tsx", "/styles.css"],
    //     }}>
    //     <SandpackLayout>
    //         <SandpackPreview 
    //             style={{ height: '100vh' }}
    //         />
    //         <SandpackCodeEditor
    //             showTabs
    //             showLineNumbers={true}
    //             showInlineErrors
    //             wrapContent
    //             closableTabs
    //             style={{ height: '100vh' }}
    //         />
    //         <SandpackFileExplorer 
    //             style={{ height: '100vh' }}
    //         />
    //     </SandpackLayout>
    // </SandpackProvider>
    <div className={styles.tt3d}>
        <Sandpack 
            template="react-ts" 
            options={{
                externalResources: ["https://cdn.tailwindcss.com"],
                editorHeight: '100vh',  
                showLineNumbers: true,
                visibleFiles:["/App.tsx", "/styles.css"],
                showInlineErrors: true,
                showTabs: true,
                rtl: true,
                showConsoleButton: true,
            }}
            // theme={amethyst}
            theme="dark"
        />
        
        <div className={styles.inputContainer}>
            <input type="text" className={styles.input} placeholder="What imagination do you wish to make reality?" />
            <div className={styles.inputFooter}>
                <div className={styles.leftButtons}>
                    <button className={styles.undoButton}>
                        <Undo2 size={16} />
                    </button>
                    <button className={styles.redoButton}>
                        <Redo2 size={16} />
                    </button>
                </div>
                <div className={styles.rightButtons}>
                    <button className={styles.c3dbtn} onClick={() => window.open("/c3d", "_blank")}>
                        Learn more about C3D
                    </button>
                    <button className={styles.inputButton}>Submit</button>
                </div>
            </div>
        </div>
    </div>
  )
}