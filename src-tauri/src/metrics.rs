use crate::models::RuntimeMetrics;
use sysinfo::{Pid, System};

#[cfg(windows)]
fn get_private_memory_mb(pid: u32) -> Option<u64> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::{
        GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS_EX,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle == 0 {
            return None;
        }
        let mut counters: PROCESS_MEMORY_COUNTERS_EX = std::mem::zeroed();
        counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;
        let ok = GetProcessMemoryInfo(handle, &mut counters as *mut _ as *mut _, counters.cb);
        CloseHandle(handle);
        if ok == 0 {
            return None;
        }
        Some((counters.PrivateUsage as u64) / 1024 / 1024)
    }
}

#[cfg(not(windows))]
fn get_private_memory_mb(_pid: u32) -> Option<u64> {
    None
}

pub fn get_runtime_metrics_impl(pid: Option<u32>) -> Result<RuntimeMetrics, String> {
    let launcher_pid = std::process::id();
    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_processes();
    sys.refresh_processes();

    let total_memory_mb = sys.total_memory() / 1024 / 1024;
    let used_memory_mb = sys.used_memory() / 1024 / 1024;
    let used_memory_percent = if total_memory_mb == 0 {
        0.0
    } else {
        (used_memory_mb as f32 / total_memory_mb as f32) * 100.0
    };

    let (launcher_memory_mb, launcher_virtual_mb) = {
        let pid = Pid::from_u32(launcher_pid);
        if let Some(proc) = sys.process(pid) {
            let private_mb = get_private_memory_mb(launcher_pid);
            (
                private_mb.or_else(|| Some(proc.memory() / 1024 / 1024)),
                Some(proc.virtual_memory() / 1024 / 1024),
            )
        } else {
            (None, None)
        }
    };

    let (process_memory_mb, process_virtual_mb) = if let Some(pid_value) = pid
    {
        let pid = Pid::from_u32(pid_value);
        if let Some(proc) = sys.process(pid) {
            let proc_mem =
                get_private_memory_mb(pid_value).unwrap_or_else(|| proc.memory() / 1024 / 1024);
            let proc_virt = proc.virtual_memory() / 1024 / 1024;
            (Some(proc_mem), Some(proc_virt))
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    Ok(RuntimeMetrics {
        used_memory_mb,
        total_memory_mb,
        used_memory_percent,
        launcher_memory_mb,
        launcher_virtual_mb,
        process_memory_mb,
        process_virtual_mb,
    })
}
