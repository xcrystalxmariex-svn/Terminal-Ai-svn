#!/usr/bin/env python3
"""
Terminal-AI Backend API Testing
Tests all backend endpoints for the Terminal-AI application
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any

class TerminalAITester:
    def __init__(self, base_url="https://dev-shell-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict[Any, Any] = None, headers: Dict[str, str] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                except:
                    response_data = {"text": response.text}
                return True, response_data
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_endpoint(self):
        """Test health endpoint returns correct v2.0.0 version"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success:
            version = response.get('version')
            if version == '2.0.0':
                print(f"   ✅ Version check passed: {version}")
                return True
            else:
                print(f"   ❌ Version mismatch: expected '2.0.0', got '{version}'")
                self.failed_tests.append({
                    "test": "Health Version Check",
                    "expected": "2.0.0",
                    "actual": version
                })
                return False
        return False

    def test_config_api(self):
        """Test config API GET/POST for saving settings"""
        print("\n📋 Testing Config API...")
        
        # Test GET config (might return 404 if no config exists)
        get_success, get_response = self.run_test(
            "Get Config",
            "GET", 
            "api/config",
            200  # Expecting 200, but 404 is also acceptable
        )
        
        # If 404, that's fine for first time
        if not get_success:
            print("   ℹ️  No existing config found (expected for first run)")
        
        # Test POST config with NIM provider fields
        test_config = {
            "provider": "nvidia_nim",
            "api_key": "test-key-123",
            "endpoint": "https://integrate.api.nvidia.com/v1/chat/completions",
            "model": "meta/llama-3.1-70b-instruct",
            "agent_name": "TestAgent",
            "system_prompt": "Test system prompt",
            "theme": "cyberpunk_void",
            "auto_execute": False,
            "nim_api_key": "nvapi-test-123",
            "nim_endpoint": "https://integrate.api.nvidia.com/v1/chat/completions",
            "nim_model": "meta/llama-3.1-70b-instruct"
        }
        
        post_success, post_response = self.run_test(
            "Save Config",
            "POST",
            "api/config",
            200,
            data=test_config
        )
        
        if post_success:
            # Verify NIM fields are saved
            nim_endpoint = post_response.get('nim_endpoint')
            nim_model = post_response.get('nim_model')
            has_nim_key = post_response.get('has_nim_key')
            
            if nim_endpoint and nim_model and has_nim_key:
                print(f"   ✅ NIM fields saved: endpoint={nim_endpoint}, model={nim_model}, has_key={has_nim_key}")
                return True
            else:
                print(f"   ❌ NIM fields missing in response")
                return False
        
        return False

    def test_chat_api_dynamic_config(self):
        """Test chat API with dynamic config override"""
        print("\n💬 Testing Chat API with Dynamic Config...")
        
        # Test chat with dynamic config override
        chat_data = {
            "content": "Hello, test message",
            "provider": "nvidia_nim",
            "api_key": "test-override-key",
            "endpoint": "https://integrate.api.nvidia.com/v1/chat/completions",
            "model": "meta/llama-3.1-8b-instruct"
        }
        
        success, response = self.run_test(
            "Chat with Dynamic Config",
            "POST",
            "api/chat",
            200,  # Expecting 200 even if AI call fails (should return error message)
            data=chat_data
        )
        
        # Note: This will likely fail due to invalid API key, but we're testing the endpoint structure
        if not success:
            # Try with just content (no dynamic config)
            simple_chat = {"content": "Simple test message"}
            success, response = self.run_test(
                "Chat Simple",
                "POST", 
                "api/chat",
                400,  # Expecting 400 due to missing API key config
                data=simple_chat
            )
            if success:
                print("   ✅ Chat endpoint properly validates missing API key")
                return True
        
        return success

    def test_grounding_execute(self):
        """Test grounding execute endpoint"""
        print("\n⚡ Testing Grounding Execute...")
        
        grounding_data = {
            "command": "echo 'Hello from grounding test'",
            "timeout": 10
        }
        
        success, response = self.run_test(
            "Grounding Execute",
            "POST",
            "api/grounding/execute", 
            200,
            data=grounding_data
        )
        
        if success:
            # Check if response has expected grounding result fields
            if 'command' in response and 'stdout' in response and 'exit_code' in response:
                print(f"   ✅ Grounding result: exit_code={response.get('exit_code')}")
                return True
            else:
                print(f"   ❌ Missing grounding result fields")
                return False
        
        return False

    def test_tool_dispatch(self):
        """Test tool dispatch endpoint with bash tool"""
        print("\n🔧 Testing Tool Dispatch...")
        
        tool_data = {
            "tool": "bash",
            "arguments": {
                "command": "echo 'Hello from tool dispatch'",
                "timeout": 10
            }
        }
        
        success, response = self.run_test(
            "Tool Dispatch - Bash",
            "POST",
            "api/tools/dispatch",
            200,
            data=tool_data
        )
        
        if success:
            # Check if response has command execution result
            if 'command' in response and 'stdout' in response:
                print(f"   ✅ Tool dispatch successful")
                return True
            else:
                print(f"   ❌ Unexpected tool dispatch response format")
                return False
        
        return False

    def test_tools_list(self):
        """Test tools list endpoint"""
        success, response = self.run_test(
            "Tools List",
            "GET",
            "api/tools/list",
            200
        )
        
        if success:
            tools = response.get('tools', [])
            if isinstance(tools, list) and len(tools) > 0:
                tool_names = [tool.get('name') for tool in tools]
                print(f"   ✅ Available tools: {', '.join(tool_names)}")
                return True
            else:
                print(f"   ❌ No tools found in response")
                return False
        
        return False

    def test_file_api(self):
        """Test file browser API"""
        print("\n📁 Testing File API...")
        
        # Test list files
        success, response = self.run_test(
            "List Files",
            "GET",
            "api/files?path=/",
            200
        )
        
        if success:
            items = response.get('items', [])
            if isinstance(items, list):
                print(f"   ✅ File listing successful: {len(items)} items")
                return True
            else:
                print(f"   ❌ Invalid file listing response")
                return False
        
        return False

    def test_terminal_api(self):
        """Test terminal execute endpoint"""
        print("\n💻 Testing Terminal API...")
        
        terminal_data = {
            "command": "echo 'Terminal test'",
            "timeout": 10
        }
        
        success, response = self.run_test(
            "Terminal Execute",
            "POST",
            "api/terminal/execute",
            200,
            data=terminal_data
        )
        
        if success:
            message = response.get('message', '')
            if 'Command' in message:
                print(f"   ✅ Terminal command executed")
                return True
            else:
                print(f"   ❌ Unexpected terminal response")
                return False
        
        return False

    def test_tts_voices_endpoint(self):
        """Test TTS voices endpoint returns list of available voices"""
        print("\n🎤 Testing TTS Voices Endpoint...")
        
        success, response = self.run_test(
            "TTS Voices List",
            "GET",
            "api/tts/voices",
            200
        )
        
        if success:
            voices = response.get('voices', [])
            if isinstance(voices, list) and len(voices) > 0:
                # Check if voices have required fields
                first_voice = voices[0]
                required_fields = ['id', 'name', 'gender', 'locale']
                if all(field in first_voice for field in required_fields):
                    print(f"   ✅ Found {len(voices)} voices with proper structure")
                    print(f"   Sample voice: {first_voice['name']} ({first_voice['gender']}, {first_voice['locale']})")
                    return True
                else:
                    print(f"   ❌ Voice objects missing required fields")
                    return False
            else:
                print(f"   ❌ No voices found in response")
                return False
        
        return False

    def test_tts_speak_endpoint(self):
        """Test TTS speak endpoint generates audio from text"""
        print("\n🔊 Testing TTS Speak Endpoint...")
        
        tts_data = {
            "text": "Hello, this is a test of the text to speech system.",
            "voice": "en-US-AriaNeural",
            "rate": "+0%",
            "pitch": "+0Hz"
        }
        
        success, response = self.run_test(
            "TTS Speak",
            "POST",
            "api/tts/speak",
            200,
            data=tts_data
        )
        
        if success:
            # Check if response has audio data
            audio_data = response.get('audio')
            audio_format = response.get('format')
            voice_used = response.get('voice')
            text_length = response.get('text_length')
            
            if audio_data and audio_format and voice_used:
                print(f"   ✅ TTS generated audio: format={audio_format}, voice={voice_used}, text_len={text_length}")
                print(f"   Audio data length: {len(audio_data)} characters (base64)")
                return True
            else:
                print(f"   ❌ TTS response missing required fields")
                return False
        
        return False

    def test_config_voice_settings(self):
        """Test config API stores and retrieves voice settings"""
        print("\n🎛️ Testing Voice Settings in Config API...")
        
        # Test POST config with voice settings
        voice_config = {
            "provider": "openai",
            "api_key": "test-key-voice",
            "endpoint": "https://api.openai.com/v1/chat/completions",
            "model": "gpt-4o",
            "agent_name": "VoiceTestAgent",
            "system_prompt": "Test voice system prompt",
            "theme": "cyberpunk_void",
            "auto_execute": False,
            # Voice settings
            "voice_enabled": True,
            "voice_id": "en-US-JennyNeural",
            "voice_rate": "+10%",
            "voice_pitch": "+5Hz",
            "voice_auto_speak": False
        }
        
        post_success, post_response = self.run_test(
            "Save Voice Config",
            "POST",
            "api/config",
            200,
            data=voice_config
        )
        
        if post_success:
            # Verify voice fields are saved
            voice_enabled = post_response.get('voice_enabled')
            voice_id = post_response.get('voice_id')
            voice_rate = post_response.get('voice_rate')
            voice_pitch = post_response.get('voice_pitch')
            voice_auto_speak = post_response.get('voice_auto_speak')
            
            if (voice_enabled is True and 
                voice_id == "en-US-JennyNeural" and 
                voice_rate == "+10%" and 
                voice_pitch == "+5Hz" and 
                voice_auto_speak is False):
                print(f"   ✅ Voice settings saved correctly")
                print(f"   Voice: {voice_id}, Rate: {voice_rate}, Pitch: {voice_pitch}")
                print(f"   Enabled: {voice_enabled}, Auto-speak: {voice_auto_speak}")
                
                # Now test GET to verify persistence
                get_success, get_response = self.run_test(
                    "Get Voice Config",
                    "GET",
                    "api/config",
                    200
                )
                
                if get_success:
                    # Verify voice settings persist
                    get_voice_enabled = get_response.get('voice_enabled')
                    get_voice_id = get_response.get('voice_id')
                    
                    if get_voice_enabled is True and get_voice_id == "en-US-JennyNeural":
                        print(f"   ✅ Voice settings persist after GET")
                        return True
                    else:
                        print(f"   ❌ Voice settings not persisted correctly")
                        return False
                
                return True
            else:
                print(f"   ❌ Voice settings not saved correctly")
                print(f"   Got: enabled={voice_enabled}, id={voice_id}, rate={voice_rate}")
                return False
        
        return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Terminal-AI Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core API tests
        tests = [
            self.test_health_endpoint,
            self.test_config_api,
            self.test_config_voice_settings,  # Test voice settings in config
            self.test_tts_voices_endpoint,    # Test TTS voices endpoint
            self.test_tts_speak_endpoint,     # Test TTS speak endpoint
            self.test_grounding_execute,
            self.test_tool_dispatch,
            self.test_tools_list,
            self.test_file_api,
            self.test_terminal_api,
            self.test_chat_api_dynamic_config,  # Test this last as it might fail due to API keys
        ]
        
        passed_tests = []
        failed_tests = []
        
        for test in tests:
            try:
                if test():
                    passed_tests.append(test.__name__)
                else:
                    failed_tests.append(test.__name__)
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {e}")
                failed_tests.append(test.__name__)
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        print("\n✅ PASSED TESTS:")
        for test in passed_tests:
            print(f"  - {test}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TerminalAITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())